import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Mismo gris que el fondo del modo oscuro (gray-950 de Tailwind)
const FONDO_OSCURO = '#030712'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': el service worker nuevo espera a que el usuario toque "Recargar" (ver AvisoPWA)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Tablero de Vida',
        short_name: 'Tablero',
        description: 'Pendientes, calendario y promedios de tu vida universitaria.',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: FONDO_OSCURO,
        background_color: FONDO_OSCURO,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Se guardan en caché solo los archivos de la app (generados en el build)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Sin conexión, cualquier ruta interna (/hoy, /promedios…) abre la app
        navigateFallback: '/index.html',
        // Sin runtimeCaching a propósito: las peticiones a Supabase (otro dominio) van siempre a la red
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
