import { applyUpdate } from '../lib/pwa.js'
import { useOnline, usePwa } from '../state/usePwa.js'
import { useT } from '../state/useT.js'

// App-wide notices at the top of every signed-in page: no connection, and a new version ready to load
export function AppNotices() {
  const online = useOnline()
  const { updateWaiting } = usePwa()
  const t = useT()
  return (
    <div className="app-notices" role="status">
      {!online && <p className="app-notice">{t('You’re offline. Pages you’ve opened still work; saving and new titles wait until you reconnect.')}</p>}
      {updateWaiting && (
        <p className="app-notice">
          {t('A new version of Netflix Clone is ready.')}
          <button type="button" className="app-notice-action" onClick={applyUpdate}>{t('Reload')}</button>
        </p>
      )}
    </div>
  )
}
