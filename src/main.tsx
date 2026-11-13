import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { requestPersistentStorage } from './db'
import { initSync } from './sync'
import { handleAuthRedirect } from './supabase'
import { trackVisit } from './admin'
import './styles.css'

// Ссылки из писем (сброс пароля, подтверждение почты) — до отрисовки приложения
handleAuthRedirect()
requestPersistentStorage()
initSync()
trackVisit()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
