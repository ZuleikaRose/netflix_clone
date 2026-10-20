import { useEffect, useRef, useState } from 'react'
import { captionsCredit, clipFor, clipSources } from '../data/clips.js'
import { readStored, writeStored } from '../lib/supabaseConfig.js'
import { useAccessibility } from '../state/accessibilityContext.js'
import { useAuth } from '../state/authContext.js'
import { Icon } from './Icon.jsx'

// Video player for the title's sample clip (data/clips.js) with custom, keyboard-accessible controls.
// Captions come from the clip's WebVTT track; the track stays "hidden" so the browser loads the cues while we draw
// them, which lets the accessibility menu size them and keeps them on screen in full screen.
const NEXT_EPISODE_DELAY = 5
const SKIP_SECONDS = 10
const speeds = [0.75, 1, 1.25, 1.5]
// Volume is 0–1; the arrow keys change it by a tenth. The last level is kept in this browser for the next video and,
// for a member, in their preferences (0–100), which win so it follows them to any device.
const VOLUME_KEY = 'netflix-clone-volume'
const VOLUME_STEP = 0.1
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

const cueText = (cue) => cue.text.replace(/<[^>]+>/g, '')

export function Player({ title, onClose }) {
  const { user, setPreference } = useAuth()
  const { settings, update } = useAccessibility()
  const clip = clipFor(title.id)
  const sources = clipSources(clip)
  const playerRef = useRef(null)
  const videoRef = useRef(null)
  const [episode, setEpisode] = useState(1)
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

  const isShow = title.type === 'show'
  const countingDown = ended && isShow && user.preferences.autoplayNext && !stayHere

  // The browser can refuse to start playback (e.g. autoplay without a user gesture); show Play instead
  const play = () => videoRef.current.play().catch(() => setPaused(true))

  // Start at the remembered level (the state already holds it; the element starts at 1)
  useEffect(() => {
    videoRef.current.volume = startLevel
  }, [startLevel])

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

  useEffect(() => {
    const track = videoRef.current.textTracks[0]
    track.mode = 'hidden'
    const showCue = () => setCaption([...(track.activeCues ?? [])].map(cueText).join('\n'))
    track.addEventListener('cuechange', showCue)
    return () => track.removeEventListener('cuechange', showCue)
  }, [])

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

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === playerRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const onLoadedMetadata = () => {
    const video = videoRef.current
    setDuration(video.duration)
    // "Continue watching" titles resume part-way through
    if (title.progress) video.currentTime = (video.duration * title.progress) / 100
    play()
  }
  const syncPosition = () => {
    setTime(videoRef.current.currentTime)
    setEnded(videoRef.current.ended)
  }

  const seekTo = (seconds) => {
    const video = videoRef.current
    video.currentTime = Math.max(0, Math.min(duration, seconds))
    setTime(video.currentTime)
    setNextIn(NEXT_EPISODE_DELAY)
    setStayHere(false)
  }
  const playEpisode = (n) => {
    setEpisode(n)
    seekTo(0)
    setEnded(false)
    play()
  }
  // Episodes are simulated: the sample clip stands in for each one
  const goToPreviousEpisode = () => { if (episode > 1) playEpisode(episode - 1) }
  const goToNextEpisode = () => playEpisode(episode + 1)
  const togglePlay = () => {
    if (ended) playEpisode(episode)
    else if (paused) play()
    else videoRef.current.pause()
  }
  const toggleCaptions = () => update({ captions: !settings.captions })
  // 0 counts as muted, so the slider and the Mute button always agree
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

  // Shortcuts work while focus is inside the player (the sliders and speed menu keep their own keys)
  const shortcuts = {
    k: togglePlay, j: () => seekTo(time - SKIP_SECONDS), l: () => seekTo(time + SKIP_SECONDS), c: toggleCaptions, m: toggleMute, f: toggleFullscreen,
    arrowup: () => changeVolume((muted ? 0 : volume) + VOLUME_STEP), arrowdown: () => changeVolume((muted ? 0 : volume) - VOLUME_STEP),
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
  const status = `${state} · ${title.title}${isShow ? ` · Episode ${episode}` : ''}`

  return (
    <>
      <section className="player" ref={playerRef} aria-label={`Video player: ${title.title}`} onKeyDown={onKeyDown}>
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
          onPlay={() => { setPaused(false); setEnded(false) }}
          onPause={() => setPaused(true)}
          onEnded={() => setEnded(true)}
          onVolumeChange={onVolumeChange}
          onRateChange={() => setSpeed(videoRef.current.playbackRate)}
        >
          <source src={sources.webm} type="video/webm" />
          <source src={sources.mp4} type="video/mp4" />
          <track kind="captions" src={sources.captions} srcLang="en" label="English" />
        </video>
        <p className="player-status" role="status">{status}{muted && ' · Muted'}</p>
        <button type="button" className="icon-button player-close" aria-label="Close player" onClick={onClose}><Icon name="close" /></button>

        {settings.captions && caption && !ended && <p className={`captions caption-${settings.captionSize}`}>{caption}</p>}

        {ended && (
          <div className="player-end" role="group" aria-label="Playback finished">
            {countingDown
              ? <>
                <p>Episode {episode + 1} starts in {nextIn}s</p>
                <button type="button" className="play" onClick={() => playEpisode(episode + 1)}>Play now</button>
                <button type="button" className="secondary" onClick={() => setStayHere(true)}>Cancel</button>
              </>
              : <>
                <p>{isShow ? `Episode ${episode} finished` : 'Finished'}</p>
                {isShow && <button type="button" className="play" onClick={() => playEpisode(episode + 1)}>Play next episode</button>}
                <button type="button" className="secondary" onClick={() => playEpisode(episode)}>Replay</button>
              </>}
          </div>
        )}

        <div className="player-bar">
          {isShow && (
            <div className="player-episodes" role="group" aria-label="Episodes">
              <button type="button" className="episode-button" aria-disabled={episode === 1} aria-keyshortcuts="Shift+P" onClick={goToPreviousEpisode}>
                <Icon name="previousEpisode" /> Previous episode
              </button>
              <span className="episode-number">Episode {episode}</span>
              <button type="button" className="episode-button" aria-keyshortcuts="Shift+N" onClick={goToNextEpisode}>
                Next episode <Icon name="nextEpisode" />
              </button>
            </div>
          )}
          <div className="player-timeline">
            <span>{clock(time)}</span>
            <input type="range" className="seek" min="0" max={Math.floor(duration)} step="1" value={Math.floor(time)} onChange={(e) => seekTo(Number(e.target.value))} aria-label="Seek" aria-valuetext={`${clock(time)} of ${clock(duration)}`} />
            <span>{clock(duration)}</span>
          </div>
          <div className="player-controls">
            <button type="button" className="icon-button" aria-label={paused || ended ? 'Play' : 'Pause'} aria-keyshortcuts="K" onClick={togglePlay}><Icon name={paused || ended ? 'play' : 'pause'} /></button>
            <button type="button" className="icon-button" aria-label={`Back ${SKIP_SECONDS} seconds`} aria-keyshortcuts="J" onClick={() => seekTo(time - SKIP_SECONDS)}><Icon name="rewind" /></button>
            <button type="button" className="icon-button" aria-label={`Forward ${SKIP_SECONDS} seconds`} aria-keyshortcuts="L" onClick={() => seekTo(time + SKIP_SECONDS)}><Icon name="forward" /></button>
            <span className="volume-control">
              <button type="button" className="icon-button" aria-label="Mute" aria-pressed={muted} aria-keyshortcuts="M" onClick={toggleMute}><Icon name={muted ? 'mute' : 'volume'} /></button>
              <input type="range" className="volume" min="0" max="100" step="5" value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => changeVolume(Number(e.target.value) / 100)} aria-label="Volume" aria-keyshortcuts="ArrowUp ArrowDown"
                aria-valuetext={muted ? 'Muted' : `${Math.round(volume * 100)}%`} />
            </span>
            <label className="speed">
              <span className="sr-only">Playback speed</span>
              <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))}>
                {speeds.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
            <button type="button" className="icon-button" aria-label="Closed captions" aria-pressed={settings.captions} aria-keyshortcuts="C" onClick={toggleCaptions}><Icon name="captions" /></button>
            {document.fullscreenEnabled && (
              <button type="button" className="icon-button" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} aria-keyshortcuts="F" onClick={toggleFullscreen}><Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} /></button>
            )}
          </div>
        </div>
      </section>
      <p className="clip-credit">
        Sample clip: <a href={clip.sourceUrl} target="_blank" rel="noreferrer">{clip.film}</a> ({clip.year}, {clip.excerpt}) by the {clip.makers},{' '}
        <a href={clip.licenseUrl} target="_blank" rel="noreferrer">{clip.license}</a>. English captions from {captionsCredit.source},{' '}
        <a href={captionsCredit.licenseUrl} target="_blank" rel="noreferrer">{captionsCredit.license}</a>.
      </p>
    </>
  )
}
