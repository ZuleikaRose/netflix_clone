import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { formatSize, removeDownload } from '../data/downloads.js'
import { useCatalog } from '../state/useCatalog.js'
import { useCanDownload, useDownloads } from '../state/useDownloads.js'

// /downloads: titles saved on this device to watch offline (data/downloads.js). Only titles the watching profile may
// see are listed.
export function Downloads() {
  const downloads = useDownloads()
  const able = useCanDownload()
  const { titles } = useCatalog()
  const shown = downloads.map((d) => ({ ...d, title: titles.find((t) => t.id === d.titleId) })).filter((d) => d.title)
  const total = shown.reduce((sum, d) => sum + d.bytes, 0)

  return (
    <>
      <PageHeader title="Downloads" back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="downloads-heading">
          <h2 id="downloads-heading">On this device</h2>
          <p className="muted">
            {able
              ? 'Downloaded titles play without a connection. Download one from its page.'
              : 'Downloads work in the installed app or once the app has loaded in your browser. Open the app again to download titles.'}
          </p>
          {shown.length === 0
            ? <p className="muted">No downloads yet.</p>
            : (
              <>
                <ul className="device-list">
                  {shown.map((d) => (
                    <li key={d.titleId}>
                      <span>
                        <Link to={`/title/${d.titleId}?play=1`} className="inline-link"><b>{d.title.title}</b></Link>
                        <span className="muted">{d.title.type === 'show' ? 'TV show' : 'Movie'} · {formatSize(d.bytes)}</span>
                      </span>
                      <button type="button" className="ghost-cta" aria-label={`Remove ${d.title.title} download`} onClick={() => removeDownload(d.titleId)}>Remove</button>
                    </li>
                  ))}
                </ul>
                <p className="muted">{shown.length} {shown.length === 1 ? 'download' : 'downloads'} · {formatSize(total)}. Sample clips shared by several titles are stored once.</p>
              </>
            )}
        </section>
      </div>
    </>
  )
}
