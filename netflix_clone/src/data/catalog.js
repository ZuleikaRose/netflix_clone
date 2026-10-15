const photo = {
  glass: 'https://images.unsplash.com/photo-1778585040075-0991abfd4ed9?auto=format&fit=crop&w=800&q=85',
  book: 'https://images.unsplash.com/photo-1733232073397-80fb13ef3212?auto=format&fit=crop&w=500&q=80',
  sign: 'https://images.unsplash.com/photo-1634840150834-f6d4544f5b9b?auto=format&fit=crop&w=500&q=80',
  light: 'https://images.unsplash.com/photo-1614201842267-206a09286c3b?auto=format&fit=crop&w=500&q=80',
}

// `tint` is a CSS filter that keeps the four source photos from looking identical across titles
export const catalog = [
  {
    id: 'behind-the-glass', title: 'Behind the Glass', type: 'show', year: 2026, maturity: 'TV-MA', seasons: 2,
    genres: ['Mystery', 'Thriller'], mood: ['Dark', 'Suspenseful', 'Mystery'], popularity: 98, isNew: true, top10: null,
    image: photo.glass, tint: 'none',
    synopsis: 'A forensic glass restorer finds handprints inside a sealed museum case — prints that match her missing sister.',
    cast: ['Mara Quinn', 'Theo Adeyemi', 'Lena Voss'],
    reviews: [{ author: 'Jordan', stars: 5, text: 'Every episode ends on a hook. Binged it in a weekend.' }],
  },
  {
    id: 'night-shift', title: 'Night Shift', type: 'show', year: 2025, maturity: 'TV-14', seasons: 3,
    genres: ['Drama', 'Mystery'], mood: ['Gritty', 'Slow Burn'], popularity: 91, isNew: false, top10: null, progress: 38,
    image: photo.book, tint: 'none',
    synopsis: 'An overnight archivist uncovers a ledger of names that keep disappearing from the city records.',
    cast: ['Ivy Marsh', 'Daniel Okafor'],
    reviews: [{ author: 'Sam', stars: 4, text: 'Moody and clever. Season 2 is the best one.' }],
  },
  {
    id: 'after-dark', title: 'After Dark', type: 'movie', year: 2024, maturity: 'R', runtime: '1h 52m',
    genres: ['Horror', 'Thriller'], mood: ['Eerie', 'Tense'], popularity: 95, isNew: false, top10: 1, progress: 57,
    image: photo.sign, tint: 'none',
    synopsis: 'A highway billboard starts displaying warnings meant for one driver — and they keep coming true.',
    cast: ['Rhea Collins', 'Marcus Bell'],
    reviews: [{ author: 'Priya', stars: 4, text: 'Simple premise, genuinely scary execution.' }],
  },
  {
    id: 'the-signal', title: 'The Signal', type: 'movie', year: 2025, maturity: 'PG-13', runtime: '2h 4m',
    genres: ['Sci-Fi', 'Thriller'], mood: ['Cerebral', 'Atmospheric'], popularity: 93, isNew: true, top10: 2, progress: 76,
    image: photo.light, tint: 'none',
    synopsis: 'A radio astronomer intercepts a transmission that seems to be coming from her own future.',
    cast: ['Noor Haddad', 'Felix Grant'],
    reviews: [],
  },
  {
    id: 'the-veil', title: 'The Veil', type: 'show', year: 2023, maturity: 'TV-MA', seasons: 1,
    genres: ['Horror', 'Drama'], mood: ['Haunting', 'Intimate'], popularity: 89, isNew: false, top10: 3,
    image: photo.glass, tint: 'sepia(.9) hue-rotate(160deg) saturate(1.8)',
    synopsis: 'A widow moves into a lake house where the fog carries voices from the families who lived there before.',
    cast: ['Adele Park', 'Simon Reyes'],
    reviews: [{ author: 'Chris', stars: 3, text: 'Gorgeous to look at, a little slow in the middle.' }],
  },
  {
    id: 'cold-open', title: 'Cold Open', type: 'movie', year: 2026, maturity: 'PG-13', runtime: '1h 38m',
    genres: ['Comedy', 'Drama'], mood: ['Witty', 'Warm'], popularity: 84, isNew: true, top10: null,
    image: photo.book, tint: 'sepia(.8) hue-rotate(-20deg)',
    synopsis: 'A washed-up sketch writer gets one last week to save a late-night show nobody watches.',
    cast: ['Gus Lindqvist', 'Tamsin Oyelaran'],
    reviews: [],
  },
  {
    id: 'static-hearts', title: 'Static Hearts', type: 'show', year: 2026, maturity: 'TV-14', seasons: 1,
    genres: ['Romance', 'Sci-Fi'], mood: ['Romantic', 'Offbeat'], popularity: 80, isNew: true, top10: null,
    image: photo.light, tint: 'hue-rotate(250deg) saturate(1.6)',
    synopsis: 'Two strangers keep hearing each other through a broken baby monitor — across two different decades.',
    cast: ['June Alvarez', 'Kit Moreau'],
    reviews: [],
  },
  {
    id: 'dead-reckoning', title: 'Dead Reckoning', type: 'movie', year: 2022, maturity: 'R', runtime: '2h 11m',
    genres: ['Action', 'Thriller'], mood: ['Relentless', 'Gritty'], popularity: 87, isNew: false, top10: 4,
    image: photo.sign, tint: 'hue-rotate(320deg) saturate(1.8)',
    synopsis: 'A disgraced navigator has one night to sail a stolen cargo ship through a storm and out of the cartel’s reach.',
    cast: ['Owen Strand', 'Bea Kaminski'],
    reviews: [{ author: 'Alex', stars: 5, text: 'Non-stop. The storm sequence is unreal.' }],
  },
  {
    id: 'lantern-island', title: 'Lantern Island', type: 'show', year: 2026, maturity: 'TV-PG', seasons: 2,
    genres: ['Adventure', 'Family'], mood: ['Whimsical', 'Heartfelt'], popularity: 82, isNew: true, top10: null,
    image: photo.light, tint: 'hue-rotate(40deg) saturate(1.8) brightness(1.15)',
    synopsis: 'Three cousins spend a summer keeping the lighthouse lit on an island where the lanterns grant small, strange wishes.',
    cast: ['Poppy Nakamura', 'Eli Brooks'],
    reviews: [{ author: 'Dana', stars: 5, text: 'Our whole family watches this together.' }],
  },
]

export const genres = [...new Set(catalog.flatMap((t) => t.genres))].sort()

export const findTitle = (id) => catalog.find((t) => t.id === id)

export const describeLength = (t) => (t.type === 'show' ? `${t.seasons} Season${t.seasons > 1 ? 's' : ''}` : t.runtime)
