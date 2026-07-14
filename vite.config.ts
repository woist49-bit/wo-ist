import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': neuer Service Worker aktiviert sich NICHT automatisch, sondern erst wenn
      // der Nutzer im Update-Banner (PwaUpdatePrompt) auf „Neu laden" tippt. So wird eine
      // laufende Spiel-Session nie mitten drin durch einen automatischen Reload unterbrochen.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wo ist...?',
        short_name: 'Wo ist...?',
        description: 'Multiplayer Suchspiel – Finde Paul!',
        theme_color: '#475569',
        background_color: '#334155',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // Der (lazy geladene) Globus-Chunk mit three.js ist groß – Precache-Limit anheben,
        // sonst bricht der Build ab. Wird nur bei Bedarf nachgeladen (Code-Splitting).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            // Das 3D-Globus-Modell (~7 MB) wird NICHT vorab gecacht (überschreitet das
            // Precache-Limit), aber nach dem ersten Laden dauerhaft gecacht -> danach offline.
            urlPattern: /\.glb$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
