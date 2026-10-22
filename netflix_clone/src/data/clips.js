// Real sample clips (public/media) from the Blender Foundation's open movies, which are Creative Commons licensed.
// Each is a short excerpt re-encoded at 360p as WebM (VP9/Opus) and MP4 (H.264/AAC). Its English captions come from
// Wikimedia Commons subtitles (CC BY-SA 4.0), with times shifted to the start of the excerpt; the Spanish captions are
// this app's translation of them, with the same times and licence.
// The catalog's titles are fictional, so each one plays one of these clips as its sample.
// Each clip also has (times in seconds):
// - recap and intro: [start, end] for TV shows, which offer Skip Recap (from the second episode) and Skip Intro while
//   they play. Episodes are simulated with the same clip, so these mark stretches of it rather than a real recap.
// - chapters: [{ start, name }], first at 0, shown as marks on the seek bar and named next to the time
export const clips = [
  {
    id: 'sintel',
    film: 'Sintel',
    year: 2010,
    excerpt: '1:45–2:37',
    makers: 'Durian Open Movie Project, Blender Foundation',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sintel_movie_4K.webm',
    recap: [0, 6.5],
    intro: [6.5, 12.5],
    chapters: [{ start: 0, name: 'The blade' }, { start: 12.5, name: 'The stranger' }, { start: 29, name: 'The quest' }, { start: 43, name: 'Alone' }],
  },
  {
    id: 'tears-of-steel',
    film: 'Tears of Steel',
    year: 2012,
    excerpt: '0:20–1:05',
    makers: 'Mango Open Movie Project, Blender Foundation',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tears_of_Steel_1080p.webm',
    recap: [0, 4.8],
    intro: [4.8, 10.6],
    chapters: [{ start: 0, name: 'The bridge' }, { start: 22.5, name: 'We’re done' }, { start: 29, name: 'Memory synced' }, { start: 40, name: 'Pretty freaky' }],
  },
  {
    id: 'elephants-dream',
    film: 'Elephants Dream',
    year: 2006,
    excerpt: '0:13–1:10',
    makers: 'Orange Open Movie Project, Blender Foundation',
    license: 'CC BY 2.5',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Elephants_Dream_(2006).webm',
    recap: [0, 5],
    intro: [5, 15.5],
    chapters: [{ start: 0, name: 'The machine' }, { start: 15.5, name: 'Watch out!' }, { start: 33, name: 'Are you hurt?' }, { start: 49, name: 'What’s next?' }],
  },
]

// Seek previews: scripts/thumbnails.mjs draws a frame every `every` seconds into <clip>.thumbs.jpg, `columns` per row
export const THUMBS = { every: 2, width: 160, height: 90, columns: 10 }

// Where in the sprite the frame for `seconds` is, as background-position (px)
export function thumbAt(seconds) {
  const i = Math.max(0, Math.floor(seconds / THUMBS.every))
  return `-${(i % THUMBS.columns) * THUMBS.width}px -${Math.floor(i / THUMBS.columns) * THUMBS.height}px`
}

// The chapter playing at `seconds`
export const chapterAt = (clip, seconds) => clip.chapters.findLast((c) => c.start <= seconds) ?? clip.chapters[0]

export const captionsCredit = { license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'Wikimedia Commons subtitles' }

// Caption languages (public/media/<clip>.<code>.vtt); the accessibility menu's Caption language picks one
export const captionLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]
export const captionLanguage = (code) => captionLanguages.find((l) => l.code === code) ?? captionLanguages[0]

const clipByTitle = {
  'behind-the-glass': 'sintel',
  'night-shift': 'tears-of-steel',
  'after-dark': 'elephants-dream',
  'the-signal': 'tears-of-steel',
  'the-veil': 'sintel',
  'cold-open': 'elephants-dream',
  'static-hearts': 'tears-of-steel',
  'dead-reckoning': 'sintel',
  'lantern-island': 'elephants-dream',
}

export const clipFor = (titleId) => clips.find((c) => c.id === (clipByTitle[titleId] ?? 'sintel'))

export const clipSources = (clip, language = 'en') => ({
  webm: `/media/${clip.id}.webm`,
  mp4: `/media/${clip.id}.mp4`,
  captions: `/media/${clip.id}.${captionLanguage(language).code}.vtt`,
  thumbs: `/media/${clip.id}.thumbs.jpg`,
})
