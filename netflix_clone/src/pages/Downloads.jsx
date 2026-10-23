import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { formatSize, removeDownload } from '../data/downloads.js'
import { useCatalog } from '../state/useCatalog.js'
import { useCanDownload, useDownloads } from '../state/useDownloads.js'
import { useT } from '../state/useT.js'

// /downloads: titles saved on this device to watch offline (data/downloads.js). Only titles the watching profile may
// see are listed.
export function Downloads() {
  const t = useT()
  const downloads = useDownloads()
  const able = useCanDownload()
  const { titles } = useCatalog()
  const shown = downloads.map((d) => ({ ...d, title: titles.find((item) => item.id === d.titleId) })).filter((d) => d.title)
  const total = shown.reduce((sum, d) => sum + d.bytes, 0)

  return (
    <>
      <PageHeader title={t('Downloads')} back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="downloads-heading">
          <h2 id="downloads-heading">{t('On this device')}</h2>
          <p className="muted">
            {able
              ? t('Downloaded titles play without a connection. Download one from its page.')
              : t('Downloads work in the installed app or once the app has loaded in your browser. Open the app again to download titles.')}
          </p>
          {shown.length === 0
            ? <p className="muted">{t('No downloads yet.')}</p>
            : (
              <>
                <ul className="device-list">
                  {shown.map((d) => (
                    <li key={d.titleId}>
                      <span>
                        <Link to={`/title/${d.titleId}?play=1`} className="inline-link"><b>{d.title.title}</b></Link>
                        <span className="muted">{d.title.type === 'show' ? t('TV show') : t('Movie')} · {formatSize(d.bytes)}</span>
                      </span>
                      <button type="button" className="ghost-cta" aria-label={t('Remove {title} download', { title: d.title.title })} onClick={() => removeDownload(d.titleId)}>{t('Remove')}</button>
                    </li>
                  ))}
                </ul>
                <p className="muted">{shown.length === 1
                  ? t('{count} download · {size}. Sample clips shared by several titles are stored once.', { count: 1, size: formatSize(total) })
                  : t('{count} downloads · {size}. Sample clips shared by several titles are stored once.', { count: shown.length, size: formatSize(total) })}</p>
              </>
            )}
        </section>
      </div>
    </>
  )
}
