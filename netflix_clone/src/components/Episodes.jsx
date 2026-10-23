import { useId } from 'react'
import { Icon } from './Icon.jsx'
import { useT } from '../state/useT.js'

// A show's episodes, one season at a time. seasons: [{ number, label }]; episodes: [{ key, code, name, meta, synopsis,
// still, percent }] or null while loading. With onPlay(episode), each episode gets a Play button.
export function Episodes({ title, seasons, season, onSeason, episodes, status, onPlay }) {
  const t = useT()
  const selectId = useId()
  return (
    <section className="episodes" aria-labelledby={`${selectId}-heading`}>
      <div className="episodes-head">
        <h3 id={`${selectId}-heading`}>{t('Episodes')}</h3>
        {seasons.length > 1
          ? (
            <span className="season-picker">
              <label htmlFor={selectId} className="sr-only">{t('Season')}</label>
              <select id={selectId} value={season} onChange={(e) => onSeason(Number(e.target.value))}>
                {seasons.map((s) => <option key={s.number} value={s.number}>{s.label}</option>)}
              </select>
            </span>
          )
          : <span className="muted">{seasons[0]?.label}</span>}
      </div>
      {status && <p className="muted" role="status">{status}</p>}
      {episodes && (
        <ol className="episode-list" aria-label={`${title}, ${seasons.find((s) => s.number === season)?.label ?? t('episodes')}`}>
          {episodes.map((e) => (
            <li key={e.key} className="episode">
              <div className="episode-top">
                {e.still && <img src={e.still} alt="" loading="lazy" className="episode-still" />}
                <div className="episode-text">
                  <p className="episode-name"><span className="muted">{e.code}</span> {e.name}</p>
                  {e.meta && <p className="muted episode-meta">{e.meta}</p>}
                </div>
                {onPlay && (
                  <button type="button" className="icon-button episode-play" aria-label={t('Play {code} {name}', { code: e.code, name: e.name })} onClick={() => onPlay(e)}>
                    <Icon name="play" />
                  </button>
                )}
              </div>
              {e.percent > 0 && (
                <div className="episode-progress" role="img" aria-label={t('{percent}% watched', { percent: e.percent })}><span style={{ width: `${e.percent}%` }} /></div>
              )}
              {e.synopsis && <p className="episode-synopsis">{e.synopsis}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
