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
  play: <path d="M7 4.5v15l12-7.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
}

export function Icon({ name, filled = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'filled' : undefined}>{iconPaths[name]}</svg>
}
