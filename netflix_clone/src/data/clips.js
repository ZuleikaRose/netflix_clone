// Real sample clips (public/media) from the Blender Foundation's open movies, which are Creative Commons licensed.
// Each is a short excerpt re-encoded at 360p as WebM (VP9/Opus) and MP4 (H.264/AAC). Its English captions come from
// Wikimedia Commons subtitles (CC BY-SA 4.0), with times shifted to the start of the excerpt.
// The catalog's titles are fictional, so each one plays one of these clips as its sample.
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
  },
]

export const captionsCredit = { license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'Wikimedia Commons subtitles' }

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

export const clipSources = (clip) => ({
  webm: `/media/${clip.id}.webm`,
  mp4: `/media/${clip.id}.mp4`,
  captions: `/media/${clip.id}.en.vtt`,
})
