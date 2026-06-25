import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

// iOS-Safari (Browser-Tab) ignoriert user-scalable=no. Diese Gesten-Events sind
// iOS-spezifisch fürs Seiten-Zoom und unabhängig von den Pointer-Events des Bild-Viewers,
// d. h. Pinch-Zoom im Bild funktioniert weiter, nur das Zoomen der ganzen Seite wird verhindert.
for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(evt, e => e.preventDefault(), { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
