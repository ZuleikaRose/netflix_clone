import { applyUpdate } from '../lib/pwa.js'
import { useOnline, usePwa } from '../state/usePwa.js'

// App-wide notices at the top of every signed-in page: no connection, and a new version ready to load
export function AppNotices() {
  const online = useOnline()
  const { updateWaiting } = usePwa()
  return (
    <div className="app-notices" role="status">
      {!online && <p className="app-notice">You’re offline. Pages you’ve opened still work; saving and new titles wait until you reconnect.</p>}
      {updateWaiting && (
        <p className="app-notice">
          A new version of Netflix Clone is ready.
          <button type="button" className="app-notice-action" onClick={applyUpdate}>Reload</button>
        </p>
      )}
    </div>
  )
}
