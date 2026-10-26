import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { completeDownloads } from './data/downloads.js'
import { registerServiceWorker } from './lib/pwa.js'
import { AccessibilityProvider } from './state/AccessibilityProvider.jsx'
import { AuthProvider } from './state/AuthProvider.jsx'
import { CatalogProvider } from './state/CatalogProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <AuthProvider>
          <AccessibilityProvider>
            <App />
          </AccessibilityProvider>
        </AuthProvider>
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>,
)

registerServiceWorker()
completeDownloads()
window.addEventListener('online', completeDownloads)
