import { useState } from 'react'
import { Icon } from './Icon.jsx'

const kindLabels = { title: 'Title', person: 'Person', genre: 'Genre', recent: 'Recent' }

// The search field as a combobox: suggestions while typing, recent searches when it's empty.
// onChange(text) as the user types; onChoose(option) for a picked option ({ kind, label, to?, genre? });
// onCommit(text) on Enter without a picked option; onClearRecent() empties the recent list.
export function SearchBox({ value, onChange, suggestions, recent, onChoose, onCommit, onClearRecent }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const showingRecent = !value.trim()
  const options = showingRecent ? recent.map((label) => ({ id: `recent:${label}`, kind: 'recent', label })) : suggestions
  const expanded = open && options.length > 0

  const close = () => {
    setOpen(false)
    setActive(-1)
  }
  const choose = (option) => {
    close()
    onChoose(option)
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return
      e.preventDefault()
      setOpen(true)
      const last = options.length - 1
      // Down from the last option (or nothing) goes to the first; up from the first (or nothing) to the last
      setActive((i) => (e.key === 'ArrowDown' ? (i >= last ? 0 : i + 1) : (i <= 0 ? last : i - 1)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (expanded && active >= 0 && active < options.length) choose(options[active])
      else {
        close()
        onCommit(value)
      }
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault()
      close()
    }
  }

  return (
    <div className="search-box">
      <label htmlFor="search-input" className="sr-only">Search titles, people, genres</label>
      <input
        id="search-input"
        type="search"
        className="search-input"
        placeholder="Search titles, people, genres"
        role="combobox"
        aria-expanded={expanded}
        aria-controls="search-options"
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 && active < options.length ? `search-option-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        autoFocus
      />
      {expanded && (
        <div className="search-popup">
          <ul id="search-options" role="listbox" aria-label={showingRecent ? 'Recent searches' : 'Suggestions'}>
            {options.map((o, i) => (
              <li
                key={o.id}
                id={`search-option-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'search-option active' : 'search-option'}
                // Keeps focus in the field, so the list doesn't close before the click lands
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <Icon name={o.kind === 'recent' ? 'search' : o.kind === 'person' ? 'profile' : o.kind === 'genre' ? 'chevron' : 'play'} />
                <span>{o.label}</span>
                <span className="muted search-option-kind">{kindLabels[o.kind]}</span>
              </li>
            ))}
          </ul>
          {showingRecent && (
            <button type="button" className="search-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { close(); onClearRecent() }}>
              Clear recent searches
            </button>
          )}
        </div>
      )}
    </div>
  )
}
