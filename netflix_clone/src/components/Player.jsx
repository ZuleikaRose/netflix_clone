import { useEffect, useRef, useState } from 'react'
import { THUMBS, captionLanguage, captionsCredit, chapterAt, clipFor, clipSources, thumbAt } from '../data/clips.js'
import { episodeCode, episodeCount, findEpisode } from '../data/episodes.js'
import { readStored, writeStored } from '../lib/supabaseConfig.js'
import { useAccessibility } from '../state/accessibilityContext.js'
import { useAuth } from '../state/authContext.js'
import { useLibrary } from '../state/libraryContext.js'
import { useProfile } from '../state/profileContext.js'
import { useScreenTime } from '../state/useScreenTime.js'
import { useAudioDescription } from '../state/useAudioDescription.js'
import { TICK_SECONDS } from '../data/screenTime.js'
import { ScreenTimeUp } from './ScreenTimeUp.jsx'
import { useT } from '../state/useT.js'
import { Icon } from './Icon.jsx'

// Video player for the title's sample clip (data/clips.js) with custom, keyboard-accessible controls.
// Captions come from the clip's WebVTT track; the track stays "hidden" so the browser loads the cues while we draw
// them, which lets the accessibility menu size them and keeps them on screen in full screen. Audio description reads a
// second track (kind "descriptions") aloud: state/useAudioDescription.js.
const NEXT_EPISODE_DELAY = 5
const SKIP_SECONDS = 10
const speeds = [0.75, 1, 1.25, 1.5]
// Volume is 0–1; the arrow keys change it by a tenth. The last level is kept in this browser for the next video and,
// for a member, in their preferences (0–100), which win so it follows them to any device.
const VOLUME_KEY = 'netflix-clone-volume'
const VOLUME_STEP = 0.1
// Continue Watching: where the viewer is gets saved on pause, on close and every so often while playing; a few seconds
// in counts as having started
const PROGRESS_SAVE_EVERY_SECONDS = 15
const MIN_WATCHED_SECONDS = 5
// Watch parties: positions closer than this count as in step
const SYNC_TOLERANCE_SECONDS = 1.5
const UNMUTE_VOLUME = 0.5 // unmuting from 0 has to land somewhere audible
const VOLUME_SAVE_DELAY_MS = 600 // dragging the slider saves once it stops
const startVolume = (preferences) => {
  const saved = preferences?.playerVolume
  if (typeof saved === 'number' && saved > 0 && saved <= 100) return saved / 100
  const level = readStored(VOLUME_KEY)
  return typeof level === 'number' && level > 0 && level <= 1 ? level : 1
}

function clock(seconds) {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const mm = h ? String(m).padStart(2, '0') : m
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

// Saves where the viewer is (watched: the player's position ref), unless they've barely started or just finished
function saveWatched(w) {
  if (!w.duration || w.ended || w.seconds < MIN_WATCHED_SECONDS) return
  w.savedAt = w.seconds
  w.save(w.titleId, { percent: Math.min(100, Math.round((w.seconds / w.duration) * 100)), episode: w.episode, seconds: w.seconds })
}

const cueText = (cue) => cue.text.replace(/<[^>]+>/g, '')

// A phone or tablet: the browser says it's mobile, or a touch screen is the main way to point (not a laptop that
// happens to have one)
const isMobileDevice = () => navigator.userAgentData?.mobile === true || window.matchMedia?.('(pointer: coarse)').matches === true

// startEpisode (shows): play that episode from the start, unless it's the one the viewer stopped in.
// Watch parties: `party` turns off starting by itself, resuming and the next-episode countdown (everyone moves
// together); onUserAction(state) reports the viewer's own play, pause, seek and episode changes, and controlRef gets
// { apply(state), snapshot() } so other members' changes can be applied. state: { playing, time, episode }.
export function Player({ title, startEpisode = null, onClose, party = false, onUserAction, controlRef }) {
  const t = useT()
  const { user, setPreference } = useAuth()
  const { settings, update } = useAccessibility()
  const { progress, saveProgress } = useLibrary()
  const { profile } = useProfile()
  // Screen-time limits: time counts while playing; once it's up the video pauses and won't start again today
  const screenTime = useScreenTime()
  const timeUp = useRef(false)
  const lastEpisode = episodeCount(title)
  const [resumeFrom] = useState(() => {
    const saved = party ? null : progress[title.id] ?? null
    return startEpisode && saved?.episode !== startEpisode ? null : saved
  })
  const clip = clipFor(title.id)
  const language = captionLanguage(settings.captionLanguage)
  const sources = clipSources(clip, language.code)
  const playerRef = useRef(null)
  const videoRef = useRef(null)
  const [episode, setEpisode] = useState(() => Math.min(Math.max(1, startEpisode ?? resumeFrom?.episode ?? 1), lastEpisode || 1))
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(true)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [startLevel] = useState(() => startVolume(user.preferences))
  const [volume, setVolume] = useState(startLevel)
  const volumeSave = useRef({ timer: null, level: null, save: setPreference })
  const [speed, setSpeed] = useState(1)
  const [caption, setCaption] = useState('')
  const [nextIn, setNextIn] = useState(NEXT_EPISODE_DELAY)
  const [stayHere, setStayHere] = useState(false) // viewer cancelled the next-episode countdown
  const [fullscreen, setFullscreen] = useState(false)
  const [pictureInPicture, setPictureInPicture] = useState(false)
  // Seek preview: the time under the pointer on the seek bar, and where along it (0–1), or null
  const [hover, setHover] = useState(null)
  // The latest position, kept in a ref so closing the player can still save it after the video element is gone
  const watched = useRef({ titleId: title.id, seconds: 0, duration: 0, episode: 1, savedAt: 0, ended: false, save: saveProgress })

  const isShow = title.type === 'show'
  const finale = isShow && episode >= lastEpisode
  const countingDown = ended && isShow && !finale && !party && user.preferences.autoplayNext && !stayHere
  // Skip Recap (a show's second episode on) or Skip Intro while that stretch plays, and Skip Outro at the end of any
  // title; the end of it to jump to. Skipping the outro finishes the title (`finish`).
  const inRange = ([start, end]) => time >= start && time < end - 0.5
  const skip = ended ? null
    : isShow && episode > 1 && inRange(clip.recap) ? { label: 'Skip Recap', to: clip.recap[1] }
      : isShow && inRange(clip.intro) ? { label: 'Skip Intro', to: clip.intro[1] }
        : inRange(clip.outro) ? { label: 'Skip Outro', finish: true } : null
  const chapter = chapterAt(clip, time)
  const canPictureInPicture = Boolean(document.pictureInPictureEnabled)
  const describe = (n) => {
    const found = findEpisode(title, n)
    return found ? `${episodeCode(found)} ${found.name}` : t('Episode {number}', { number: n })
  }

  // The browser can refuse to start playback (e.g. autoplay without a user gesture); show Play instead
  const play = () => (timeUp.current ? undefined : videoRef.current.play().catch(() => setPaused(true)))

  // Start at the remembered level (the state already holds it; the element starts at 1)
  useEffect(() => {
    videoRef.current.volume = startLevel
  }, [startLevel])

  const recordProgress = () => saveWatched(watched.current)
  useEffect(() => {
    watched.current.save = saveProgress
  })
  useEffect(() => {
    const w = watched.current
    return () => saveWatched(w)
  }, [])
  // A movie or a show's last episode watched to the end leaves Continue Watching; otherwise a show moves on to the
  // start of the next episode
  const recordFinished = () => {
    const w = watched.current
    w.ended = true
    w.save(w.titleId, isShow && w.episode < lastEpisode
      ? { percent: 0, episode: w.episode + 1, seconds: 0 }
      : { percent: 100, episode: w.episode, seconds: w.duration })
  }

  // The member's volume is saved a moment after the last change, and right away if the player closes first
  useEffect(() => {
    volumeSave.current.save = setPreference
  })
  useEffect(() => {
    const pending = volumeSave.current
    return () => {
      clearTimeout(pending.timer)
      if (pending.level != null) pending.save('playerVolume', pending.level)
    }
  }, [])
  const saveVolumeForMember = (level) => {
    const pending = volumeSave.current
    clearTimeout(pending.timer)
    pending.level = Math.round(level * 100)
    pending.timer = setTimeout(() => {
      pending.save('playerVolume', pending.level)
      pending.level = null
    }, VOLUME_SAVE_DELAY_MS)
  }

  // A new caption language swaps the <track> (keyed by language), so pick up the new one
  const languageCode = language.code
  useEffect(() => {
    const track = videoRef.current.textTracks.getTrackById(`captions-${languageCode}`)
    if (!track) return undefined
    track.mode = 'hidden'
    const showCue = () => setCaption([...(track.activeCues ?? [])].map(cueText).join('\n'))
    track.addEventListener('cuechange', showCue)
    return () => {
      track.removeEventListener('cuechange', showCue)
      track.mode = 'disabled'
    }
  }, [languageCode])
  useAudioDescription(videoRef, { on: settings.audioDescription, languageCode, pauseWhileSpeaking: !party })

  useEffect(() => {
    timeUp.current = screenTime.timeUp
    if (screenTime.timeUp) videoRef.current?.pause()
  }, [screenTime.timeUp])
  const { limit: dailyLimit, addSeconds: addScreenSeconds } = screenTime
  useEffect(() => {
    if (!dailyLimit || paused || ended) return undefined
    const id = setInterval(() => addScreenSeconds(TICK_SECONDS), TICK_SECONDS * 1000)
    return () => clearInterval(id)
  }, [dailyLimit, paused, ended, addScreenSeconds])

  // "Autoplay next episode": count down, then start it (the sample clip stands in for every episode)
  useEffect(() => {
    if (!countingDown) return
    let left = NEXT_EPISODE_DELAY
    const id = setInterval(() => {
      left -= 1
      setNextIn(left)
      if (left === 0) {
        setEpisode((n) => n + 1)
        setNextIn(NEXT_EPISODE_DELAY)
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => setPaused(true))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [countingDown])

  // Opened from an episode further down the page: bring the player into view
  useEffect(() => {
    playerRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  // React has no props for these events. Closing the player leaves picture-in-picture too (the video is going away).
  useEffect(() => {
    const video = videoRef.current
    const enter = () => setPictureInPicture(true)
    const leave = () => setPictureInPicture(false)
    video.addEventListener('enterpictureinpicture', enter)
    video.addEventListener('leavepictureinpicture', leave)
    return () => {
      video.removeEventListener('enterpictureinpicture', enter)
      video.removeEventListener('leavepictureinpicture', leave)
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {})
    }
  }, [])

  // On a phone or tablet, full screen also turns the video sideways: the screen is locked to landscape until full
  // screen ends. Browsers that can't lock the orientation (iPhone Safari, desktops) refuse, and nothing changes.
  useEffect(() => {
    let locked = false
    const sync = () => {
      const on = document.fullscreenElement === playerRef.current
      setFullscreen(on)
      if (on && isMobileDevice()) {
        screen.orientation?.lock?.('landscape').then(() => { locked = true }, () => {})
      } else if (!on && locked) {
        locked = false
        try { screen.orientation.unlock() } catch { /* already unlocked with full screen */ }
      }
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const onLoadedMetadata = () => {
    const video = videoRef.current
    setDuration(video.duration)
    // "Continue watching" titles resume where the viewer stopped (the built-in samples only know a percentage)
    if (resumeFrom) video.currentTime = resumeFrom.seconds ?? (video.duration * resumeFrom.percent) / 100
    if (!party) play()
  }
  const syncPosition = () => {
    const video = videoRef.current
    setTime(video.currentTime)
    // Sitting at the very end counts as finished too: a paused video moved there (finishNow) doesn't always say ended
    setEnded(video.ended || (video.duration > 0 && video.currentTime >= video.duration))
    Object.assign(watched.current, { seconds: video.currentTime, duration: video.duration || 0, episode })
    if (Math.abs(video.currentTime - watched.current.savedAt) >= PROGRESS_SAVE_EVERY_SECONDS) recordProgress()
  }

  // Tells a watch party what this viewer just did
  const report = (state) => {
    const video = videoRef.current
    onUserAction?.({ playing: !video.paused && !video.ended, time: video.currentTime, episode, ...state })
  }
  const moveTo = (seconds) => {
    const video = videoRef.current
    // Before the metadata loads (a party member joining) the length isn't known yet
    video.currentTime = Math.max(0, Math.min(duration || video.duration || Infinity, seconds))
    setTime(video.currentTime)
    setNextIn(NEXT_EPISODE_DELAY)
    setStayHere(false)
  }
  const seekTo = (seconds) => {
    moveTo(seconds)
    report({ time: videoRef.current.currentTime })
  }
  const startEpisodeAt = (n) => {
    setEpisode(n)
    moveTo(0)
    setEnded(false)
    play()
  }
  const playEpisode = (n) => {
    startEpisodeAt(n)
    report({ episode: n, time: 0, playing: true })
  }
  // Episodes are simulated: the sample clip stands in for each one
  const goToPreviousEpisode = () => { if (episode > 1) playEpisode(episode - 1) }
  const goToNextEpisode = () => { if (!finale) playEpisode(episode + 1) }
  const togglePlay = () => {
    if (ended) playEpisode(episode)
    else if (paused) {
      play()
      report({ playing: true })
    } else {
      videoRef.current.pause()
      report({ playing: false })
    }
  }

  // Another party member's change. Small differences in position are left alone, so playback doesn't stutter.
  useEffect(() => {
    if (!controlRef) return
    controlRef.current = {
      apply({ playing, time: at, episode: ep }) {
        const video = videoRef.current
        if (!video) return
        if (ep && ep !== episode) {
          setEpisode(ep)
          setEnded(false)
        }
        if (Math.abs(video.currentTime - at) > SYNC_TOLERANCE_SECONDS) moveTo(at)
        if (playing && video.paused) play()
        else if (!playing && !video.paused) video.pause()
      },
      snapshot: () => {
        const video = videoRef.current
        return video ? { playing: !video.paused && !video.ended, time: video.currentTime, episode } : null
      },
    }
  })
  const toggleCaptions = () => update({ captions: !settings.captions })
  const toggleAudioDescription = () => update({ audioDescription: !settings.audioDescription })
  // 0 counts as muted, so the slider and the Mute button always agree
  // From the element, not state: state catches up on 'volumechange', so quick key presses would each start from the
  // same old level
  const currentLevel = () => (videoRef.current.muted ? 0 : videoRef.current.volume)
  const changeVolume = (level) => {
    const video = videoRef.current
    const next = Math.round(Math.max(0, Math.min(1, level)) * 100) / 100
    video.volume = next
    video.muted = next === 0
    if (next > 0) {
      writeStored(VOLUME_KEY, next)
      saveVolumeForMember(next)
    }
  }
  const toggleMute = () => {
    const video = videoRef.current
    if (video.muted && video.volume === 0) changeVolume(UNMUTE_VOLUME)
    else video.muted = !video.muted
  }
  const onVolumeChange = () => {
    setMuted(videoRef.current.muted)
    setVolume(videoRef.current.volume)
  }
  const changeSpeed = (rate) => { videoRef.current.playbackRate = rate }
  // The browser can refuse full screen (e.g. inside an iframe); staying windowed is the only sensible fallback
  const toggleFullscreen = () => {
    const request = fullscreen ? document.exitFullscreen() : playerRef.current.requestFullscreen?.()
    request?.catch(() => setFullscreen(document.fullscreenElement === playerRef.current))
  }

  // The browser can refuse (e.g. the video has no frames yet); the button then just stays as it was
  const togglePictureInPicture = () => {
    const request = document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current.requestPictureInPicture()
    request.catch(() => {})
  }
  // Skipping the outro goes straight to the end screen (and a show's next-episode countdown), as reaching the end does
  const finishNow = () => {
    const video = videoRef.current
    video.pause()
    moveTo(video.duration || duration)
    // Saved where it ends first, as playing through to the end does (that's what puts it in the viewing history),
    // then as finished
    Object.assign(watched.current, { seconds: video.currentTime, duration: video.duration || duration, episode })
    recordProgress()
    setEnded(true)
    recordFinished()
    report({ playing: false })
  }
  // The seek bar moves in whole seconds, so its end sits a moment before the clip's (52 of 52.008 s): reaching it
  // finishes the title, rather than leaving the last fraction of a second to play (or never play, when paused)
  const scrubTo = (seconds) => {
    if (duration && seconds >= Math.floor(duration)) finishNow()
    else seekTo(seconds)
  }
  const skipAhead = () => {
    if (skip?.finish) finishNow()
    else if (skip) seekTo(skip.to)
  }
  const previewAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const at = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    setHover(duration ? { at, seconds: at * duration } : null)
  }

  // Shortcuts work while focus is inside the player (the sliders and speed menu keep their own keys)
  const shortcuts = {
    k: togglePlay, j: () => seekTo(time - SKIP_SECONDS), l: () => seekTo(time + SKIP_SECONDS), c: toggleCaptions, d: toggleAudioDescription, m: toggleMute, f: toggleFullscreen, s: skipAhead,
    ...(canPictureInPicture && { i: togglePictureInPicture }),
    arrowup: () => changeVolume(currentLevel() + VOLUME_STEP), arrowdown: () => changeVolume(currentLevel() - VOLUME_STEP),
    ...(isShow && { 'shift+p': goToPreviousEpisode, 'shift+n': goToNextEpisode }),
  }
  const onKeyDown = (e) => {
    const key = e.key.toLowerCase()
    const action = (e.shiftKey && shortcuts[`shift+${key}`]) || shortcuts[key]
    if (!action || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, select, textarea')) return
    e.preventDefault()
    action()
  }

  const state = ended ? 'Finished' : paused ? 'Paused' : 'Now playing'
  const status = `${t(state)} · ${title.title}${isShow ? ` · ${describe(episode)}` : ''}`

  return (
    <>
      <section className="player" ref={playerRef} aria-label={t('Video player: {title}', { title: title.title })} onKeyDown={onKeyDown}>
        <video
          ref={videoRef}
          poster={title.image}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={() => setDuration(videoRef.current.duration)}
          onTimeUpdate={syncPosition}
          onSeeked={syncPosition}
          onPlay={() => {
            if (timeUp.current) return videoRef.current.pause()
            setPaused(false); setEnded(false); watched.current.ended = false
          }}
          onPause={() => { setPaused(true); recordProgress() }}
          onEnded={() => { setEnded(true); recordFinished() }}
          onVolumeChange={onVolumeChange}
          onRateChange={() => setSpeed(videoRef.current.playbackRate)}
        >
          <source src={sources.webm} type="video/webm" />
          <source src={sources.mp4} type="video/mp4" />
          <track key={language.code} id={`captions-${language.code}`} kind="captions" src={sources.captions} srcLang={language.code} label={language.label} />
          <track key={`descriptions-${language.code}`} id={`descriptions-${language.code}`} kind="descriptions" src={sources.descriptions}
            srcLang={language.code} label={t('{language}: audio description', { language: language.label })} />
        </video>
        <p className="player-status" role="status">{status}{muted && ` · ${t('Muted')}`}</p>
        <p className="player-chapter">{t('Chapter: {name}', { name: t(chapter.name) })}</p>
        {canPictureInPicture && (
          <button type="button" className="icon-button player-pip" aria-label={t('Picture in picture')} aria-pressed={pictureInPicture} aria-keyshortcuts="I" onClick={togglePictureInPicture}><Icon name="pictureInPicture" /></button>
        )}
        <button type="button" className="icon-button player-ad" aria-label={t('Audio description')} aria-pressed={settings.audioDescription} aria-keyshortcuts="D"
          onClick={toggleAudioDescription}><span className="ad-mark" aria-hidden="true">AD</span></button>
        <button type="button" className="icon-button player-close" aria-label={t('Close player')} onClick={onClose}><Icon name="close" /></button>

        {settings.captions && caption && !ended && <p className={`captions caption-${settings.captionSize}`} lang={language.code}>{caption}</p>}
        {skip && !screenTime.timeUp && <button type="button" className="skip-button" aria-keyshortcuts="S" onClick={skipAhead}>{t(skip.label)}</button>}

        {screenTime.timeUp && (
          <ScreenTimeUp profileName={profile.name} limit={screenTime.limit} onAllow={screenTime.allowMoreTime} onClose={onClose} />
        )}
        {ended && !screenTime.timeUp && (
          <div className="player-end" role="group" aria-label={t('Playback finished')}>
            {countingDown
              ? <>
                <p>{t('{episode} starts in {seconds}s', { episode: describe(episode + 1), seconds: nextIn })}</p>
                <button type="button" className="play" onClick={() => playEpisode(episode + 1)}>{t('Play now')}</button>
                <button type="button" className="secondary" onClick={() => setStayHere(true)}>{t('Cancel')}</button>
              </>
              : <>
                <p>{!isShow ? t('Finished') : finale ? t('{episode} finished · that’s the end of the series', { episode: describe(episode) }) : t('{episode} finished', { episode: describe(episode) })}</p>
                {isShow && !finale && <button type="button" className="play" onClick={() => playEpisode(episode + 1)}>{t('Play next episode')}</button>}
                <button type="button" className="secondary" onClick={() => playEpisode(episode)}>{t('Replay')}</button>
              </>}
          </div>
        )}

        <div className="player-bar">
          {isShow && (
            <div className="player-episodes" role="group" aria-label={t('Episodes')}>
              <button type="button" className="episode-button" aria-disabled={episode === 1} aria-keyshortcuts="Shift+P" onClick={goToPreviousEpisode}>
                <Icon name="previousEpisode" /> {t('Previous episode')}
              </button>
              <span className="episode-number">{findEpisode(title, episode) ? episodeCode(findEpisode(title, episode)) : t('Episode {number}', { number: episode })}</span>
              <button type="button" className="episode-button" aria-disabled={finale} aria-keyshortcuts="Shift+N" onClick={goToNextEpisode}>
                {t('Next episode')} <Icon name="nextEpisode" />
              </button>
            </div>
          )}
          <div className="player-timeline">
            <span>{clock(time)}</span>
            <div className="seek-track" onPointerMove={previewAt} onPointerDown={previewAt} onPointerLeave={() => setHover(null)}>
              <input type="range" className="seek" min="0" max={Math.floor(duration)} step="1" value={Math.floor(time)} onChange={(e) => scrubTo(Number(e.target.value))}
                aria-label={t('Seek')} aria-valuetext={t('{time} of {duration}, chapter: {chapter}', { time: clock(time), duration: clock(duration), chapter: t(chapter.name) })} />
              {duration > 0 && clip.chapters.slice(1).map((c) => (
                <span key={c.start} className="chapter-mark" style={{ left: `${(c.start / duration) * 100}%` }} aria-hidden="true" />
              ))}
              {hover && (
                <span className="seek-preview" style={{ left: `clamp(${THUMBS.width / 2}px, ${hover.at * 100}%, calc(100% - ${THUMBS.width / 2}px))` }} aria-hidden="true">
                  <span className="seek-thumb" style={{ backgroundImage: `url(${sources.thumbs})`, backgroundPosition: thumbAt(hover.seconds), width: THUMBS.width, height: THUMBS.height }} />
                  <span>{clock(hover.seconds)} · {t(chapterAt(clip, hover.seconds).name)}</span>
                </span>
              )}
            </div>
            <span>{clock(duration)}</span>
          </div>

          <div className="player-controls">
            <button type="button" className="icon-button" aria-label={paused || ended ? t('Play') : t('Pause')} aria-keyshortcuts="K" onClick={togglePlay}><Icon name={paused || ended ? 'play' : 'pause'} /></button>
            <button type="button" className="icon-button" aria-label={t('Back {seconds} seconds', { seconds: SKIP_SECONDS })} aria-keyshortcuts="J" onClick={() => seekTo(time - SKIP_SECONDS)}><Icon name="rewind" /></button>
            <button type="button" className="icon-button" aria-label={t('Forward {seconds} seconds', { seconds: SKIP_SECONDS })} aria-keyshortcuts="L" onClick={() => seekTo(time + SKIP_SECONDS)}><Icon name="forward" /></button>
            <span className="volume-control">
              <button type="button" className="icon-button" aria-label={t('Mute')} aria-pressed={muted} aria-keyshortcuts="M" onClick={toggleMute}><Icon name={muted ? 'mute' : 'volume'} /></button>
              <input type="range" className="volume" min="0" max="100" step="5" value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => changeVolume(Number(e.target.value) / 100)} aria-label={t('Volume')} aria-keyshortcuts="ArrowUp ArrowDown"
                aria-valuetext={muted ? t('Muted') : `${Math.round(volume * 100)}%`} />
            </span>
            <label className="speed">
              <span className="sr-only">{t('Playback speed')}</span>
              <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))}>
                {speeds.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
            <button type="button" className="icon-button" aria-label={t('Closed captions')} aria-pressed={settings.captions} aria-keyshortcuts="C" onClick={toggleCaptions}><Icon name="captions" /></button>
            {document.fullscreenEnabled && (
              <button type="button" className="icon-button" aria-label={fullscreen ? t('Exit full screen') : t('Full screen')} aria-keyshortcuts="F" onClick={toggleFullscreen}><Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} /></button>
            )}
          </div>
        </div>
      </section>
      <p className="clip-credit">
        {t('Sample clip:')} <a href={clip.sourceUrl} target="_blank" rel="noreferrer">{clip.film}</a> {t('({year}, {excerpt}) by the {makers},', { year: clip.year, excerpt: clip.excerpt, makers: clip.makers })}{' '}
        <a href={clip.licenseUrl} target="_blank" rel="noreferrer">{clip.license}</a>. {language.code === 'en' ? t('English captions from') : t('Spanish captions translated from')} {t(captionsCredit.source)},{' '}
        <a href={captionsCredit.licenseUrl} target="_blank" rel="noreferrer">{captionsCredit.license}</a>.
      </p>
    </>
  )
}
