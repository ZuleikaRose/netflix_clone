// Each shortcut: [keys, what it does]; 'or' and '+' between keys are shown as words.
// The keyboard shortcuts help (? anywhere, or the accessibility menu). Keep it in step with the handlers:
// components/Player.jsx (`shortcuts`), components/SearchBox.jsx and components/ShortcutsDialog.jsx.
export const shortcutGroups = [
  {
    heading: 'Anywhere',
    keys: [
      [['?'], 'Show these keyboard shortcuts'],
      [['Tab'], 'Move to the next link or button (Shift+Tab goes back)'],
      [['Esc'], 'Close a menu or dialog'],
    ],
  },
  {
    heading: 'Video player',
    note: 'While focus is inside the player.',
    keys: [
      [['K'], 'Play or pause'],
      [['J'], 'Back 10 seconds'],
      [['L'], 'Forward 10 seconds'],
      [['↑', 'or', '↓'], 'Volume up or down by 10%'],
      [['M'], 'Mute or unmute'],
      [['C'], 'Captions on or off'],
      [['S'], 'Skip the recap or intro'],
      [['I'], 'Picture-in-picture (where the browser supports it)'],
      [['F'], 'Full screen'],
      [['Shift', '+', 'P'], 'Previous episode (TV shows)'],
      [['Shift', '+', 'N'], 'Next episode (TV shows)'],
    ],
  },
  {
    heading: 'Search box',
    keys: [
      [['↑', 'or', '↓'], 'Move through the suggestions'],
      [['Enter'], 'Open the highlighted suggestion, or search'],
      [['Esc'], 'Close the suggestions'],
    ],
  },
]

// Typing in a field (or a key with Ctrl/Cmd/Alt) never opens the help
export function opensShortcutHelp(e) {
  if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false
  return !e.target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}
