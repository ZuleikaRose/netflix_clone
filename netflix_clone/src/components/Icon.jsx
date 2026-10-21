const iconPaths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
  games: <><path d="M8.5 7h7a6.5 6.5 0 0 1 6.2 8.5l-1 3a2.8 2.8 0 0 1-4.5 1.2L14 18h-4l-2.2 1.7a2.8 2.8 0 0 1-4.5-1.2l-1-3A6.5 6.5 0 0 1 8.5 7Z" /><path d="M7 11v4M5 13h4M17 12h.01M19 15h.01" /></>,
  new: <><path d="M4 5h16v14H4z" /><path d="m10 9 5 3-5 3Z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  back: <path d="m15 18-6-6 6-6" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  play: <path d="M7 4.5v15l12-7.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></>,
  accessibility: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="6.8" r="1.4" /><path d="M7 9.6 12 11l5-1.4M12 11v3.2l-2.4 4.6M12 14.2l2.4 4.6" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6" /></>,
  volume: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  previousEpisode: <path d="M6 6v12M19 6l-9 6 9 6Z" />,
  nextEpisode: <path d="M18 6v12M5 6l9 6-9 6Z" />,
  mute: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  rewind: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /><path d="M10 10v5M13 10h2.5v5H13Z" /></>,
  forward: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v4.5h-4.5" /><path d="M8.5 10v5M11.5 10H14v5h-2.5Z" /></>,
  fullscreen: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  exitFullscreen: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
}

export function Icon({ name, filled = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'filled' : undefined}>{iconPaths[name]}</svg>
}
