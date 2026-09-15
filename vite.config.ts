import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/schurco-crm/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-impeller-192.png', 'icon-impeller-512.png'],
      manifest: {
        name: 'Schurco CRM',
        short_name: 'Schurco CRM',
        start_url: '.',
        display: 'standalone',
        background_color: '#0f1a0f',
        theme_color: '#218240',
        icons: [
          { src: 'icon-impeller-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-impeller-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
