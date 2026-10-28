import { useSyncExternalStore } from 'react'

// Devuelve true mientras la pantalla cumpla la consulta CSS, y se actualiza sola
// si cambia (girar el celular, redimensionar la ventana).
//   const ancha = useMediaQuery('(min-width: 640px)')   // 640px = breakpoint "sm" de Tailwind
export function useMediaQuery(consulta) {
  return useSyncExternalStore(
    (avisar) => {
      const mql = window.matchMedia(consulta)
      mql.addEventListener('change', avisar)
      return () => mql.removeEventListener('change', avisar)
    },
    () => window.matchMedia(consulta).matches,
  )
}
