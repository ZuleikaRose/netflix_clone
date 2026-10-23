import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadTitle, formatSize, removeDownload } from '../data/downloads.js'
import { useCanDownload, useDownloads } from '../state/useDownloads.js'
import { Icon } from './Icon.jsx'
import { useT } from '../state/useT.js'

// On a catalog title's page: save its sample clip for watching offline, or remove it
export function DownloadButton({ title }) {
  const t = useT()
  const able = useCanDownload()
  const downloads = useDownloads()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const download = downloads.find((d) => d.titleId === title.id)
  if (!able && !download) return null

  const start = async () => {
    setBusy(true)
    setError(null)
    setError(await downloadTitle(title.id))
    setBusy(false)
  }

  return (
    <div className="download-row">
      {download
        ? (
          <>
            <p className="muted" role="status"><Icon name="check" /> {t('Downloaded ({size}) · plays offline ·', { size: formatSize(download.bytes) })} <Link to="/downloads" className="inline-link">{t('Downloads')}</Link></p>
            <button type="button" className="ghost-cta" onClick={() => removeDownload(title.id)}>{t('Remove download')}</button>
          </>
        )
        : (
          <>
            <button type="button" className="ghost-cta" onClick={start} disabled={busy} aria-describedby={error ? 'download-error' : undefined}>
              <Icon name="download" /> {busy ? t('Downloading…') : t('Download to watch offline')}
            </button>
            {busy && <p className="muted" role="status">{t('Downloading {title}…', { title: title.title })}</p>}
            {error && <p id="download-error" className="form-alert" role="alert">{error}</p>}
          </>
        )}
    </div>
  )
}
