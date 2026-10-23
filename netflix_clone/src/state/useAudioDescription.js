import { useEffect } from 'react'

// About how long a description takes to read, for browsers whose speech never reports the end (no voices installed)
const SECONDS_PER_WORD = 0.45
const READ_MARGIN_MS = 1500
const speechLang = { en: 'en-US', es: 'es-ES' }

// Audio description for the player: while `on`, each cue of the <track id="descriptions-<language>"> is read aloud
// by the browser's speech synthesis as it's reached. With `pauseWhileSpeaking` (everywhere but watch parties, which
// must stay in step) the video waits while a description is read, then carries on: extended audio description, so
// descriptions never talk over the dialogue. Reaching a cue again (after seeking back) reads it again.
export function useAudioDescription(videoRef, { on, languageCode, pauseWhileSpeaking }) {
  useEffect(() => {
    const video = videoRef.current
    const track = video?.textTracks.getTrackById(`descriptions-${languageCode}`)
    const synth = typeof window === 'undefined' ? null : window.speechSynthesis
    if (!on || !track || !synth) return undefined
    track.mode = 'hidden'
    let current = null // the cue being (or just) read
    let holding = false // the video is paused for a description
    let fallback = null

    const carryOn = () => {
      clearTimeout(fallback)
      if (holding && video.paused && !video.ended) video.play().catch(() => {})
      holding = false
    }
    // The viewer pressed Play themselves: don't pause for this description any more
    const onPlay = () => { holding = false }
    const read = () => {
      const cue = track.activeCues?.[0] ?? null
      if (cue === current) return
      current = cue
      if (!cue) return
      const text = cue.text.replace(/<[^>]+>/g, '')
      synth.cancel()
      clearTimeout(fallback)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speechLang[languageCode] ?? languageCode
      utterance.onend = carryOn
      utterance.onerror = carryOn
      if (pauseWhileSpeaking && !video.paused) {
        holding = true
        video.pause()
      }
      fallback = setTimeout(carryOn, READ_MARGIN_MS + text.split(/\s+/).length * SECONDS_PER_WORD * 1000)
      synth.speak(utterance)
    }

    track.addEventListener('cuechange', read)
    video.addEventListener('play', onPlay)
    return () => {
      track.removeEventListener('cuechange', read)
      video.removeEventListener('play', onPlay)
      synth.cancel()
      // Turning it off (or closing) mid-description lets the video carry on
      carryOn()
      track.mode = 'disabled'
    }
  }, [videoRef, on, languageCode, pauseWhileSpeaking])
}
