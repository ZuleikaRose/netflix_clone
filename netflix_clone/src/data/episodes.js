// The built-in shows' episodes. They're simulated like the player's video (the sample clip stands in for every
// episode), but each show has a fixed list: seasons of named episodes, numbered 1… across the whole series, which is
// what the player and Continue Watching store (`progress.episode`).
import { tr } from '../i18n/index.js'

const FIRST_SEASON_EPISODES = 8
const LATER_SEASON_EPISODES = 6
const names = [
  'Pilot', 'The Long Night', 'Crossings', 'Static', 'What the River Knows', 'Open Water', 'Second Chances', 'The Signal',
  'Glass Houses', 'Undertow', 'Low Tide', 'The Keeper', 'Fault Lines', 'Paper Moons', 'The Quiet Hour', 'Northbound',
  'Smoke and Mirrors', 'Afterglow', 'Lanterns', 'Homecoming', 'The Last Ferry', 'Daybreak', 'Echoes', 'Full Circle',
]

// A small stable number per title, so every show gets its own names and lengths
const seedOf = (id) => [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 9973, 7)

// [{ season, episodes: [{ number, season, inSeason, name, minutes }] }]; [] for movies
export function seasonsFor(title) {
  if (title.type !== 'show') return []
  const seed = seedOf(title.id)
  let number = 0
  return Array.from({ length: title.seasons }, (_, s) => ({
    season: s + 1,
    episodes: Array.from({ length: s === 0 ? FIRST_SEASON_EPISODES : LATER_SEASON_EPISODES }, (_, e) => {
      number += 1
      return {
        number,
        season: s + 1,
        inSeason: e + 1,
        // The series starts with its pilot; the rest take names from the list, never repeating within a show. In the
        // interface language (src/i18n/es/content.js)
        name: tr(number === 1 ? names[0] : names[1 + ((seed + number * 7) % (names.length - 1))]),
        minutes: 42 + ((seed + number * 5) % 17),
      }
    }),
  }))
}

export const episodeCount = (title) => seasonsFor(title).reduce((sum, s) => sum + s.episodes.length, 0)

// Episode `number` (1… across the series), or null
export const findEpisode = (title, number) => seasonsFor(title).flatMap((s) => s.episodes).find((e) => e.number === number) ?? null

// "S2:E3"
export const episodeCode = (episode) => `S${episode.season}:E${episode.inSeason}`
