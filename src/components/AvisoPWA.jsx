import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CADA_HORA = 60 * 60 * 1000

// Registra el service worker (lo hace el plugin PWA) y muestra dos avisos:
// - una versión nueva de la app lista para usar, con botón "Recargar";
// - una pantalla amable cuando el dispositivo no tiene internet.
export default function AvisoPWA() {
  const [sinConexion, setSinConexion] = useState(!navigator.onLine)

  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    // Si la app queda abierta mucho tiempo, busca actualizaciones cada hora
    onRegisteredSW(_url, registro) {
      if (registro) setInterval(() => registro.update(), CADA_HORA)
    },
  })

  useEffect(() => {
    const alCambiar = () => setSinConexion(!navigator.onLine)
    window.addEventListener('online', alCambiar)
    window.addEventListener('offline', alCambiar)
    return () => {
      window.removeEventListener('online', alCambiar)
      window.removeEventListener('offline', alCambiar)
    }
  }, [])

  return (
    <>
      {hayVersionNueva && (
        // bottom-20: en celular deja libre la barra de navegación fija de abajo
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg sm:bottom-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <span>Hay una versión nueva</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setHayVersionNueva(false)}
              className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Luego
            </button>
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
            >
              Recargar
            </button>
          </div>
        </div>
      )}

      {sinConexion && (
        // Cubre la app pero no la desmonta: al volver internet desaparece y todo sigue como estaba
        <div
          role="alert"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white p-6 text-center dark:bg-gray-950"
        >
          <span className="text-5xl" aria-hidden="true">
            📡
          </span>
          <h2 className="text-xl font-semibold">Sin conexión</h2>
          <p className="max-w-xs text-gray-600 dark:text-gray-400">
            Tablero de Vida necesita internet para traer tus datos al día. Se reanuda solo cuando
            vuelva la conexión.
          </p>
          <button
            onClick={() => setSinConexion(!navigator.onLine)}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Reintentar
          </button>
        </div>
      )}
    </>
  )
}
