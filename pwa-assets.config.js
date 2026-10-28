import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los PNG de la PWA a partir de public/icon.svg (npm run generar-iconos).
// En los íconos "maskable" y de Apple el fondo es el acento, para que no queden bordes blancos.
const fondo = '#4f46e5'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: fondo } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: fondo } },
  },
  images: ['public/icon.svg'],
})
