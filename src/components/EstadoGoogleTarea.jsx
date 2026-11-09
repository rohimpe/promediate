import { useState } from 'react'
import { useConexionGoogle } from '../hooks/useConexionGoogle'
import { enlaceEventoGoogle } from '../lib/googleApi'
import { IconoGoogle } from './calendario/BloqueEvento'

// Cómo está un pendiente en Google Calendar. Solo se ve si Google está conectado (si no, nada: sin avisos molestos).
//   google_sync 'ok'                  -> ícono de Google y "Abrir en Google Calendar"
//   google_sync 'pendiente' / 'error' -> aviso discreto con "Reintentar"
//   onReintentar: () => Promise (el `sincronizar` de useTasks); sin él, el aviso no lleva botón
export default function EstadoGoogleTarea({ tarea, onReintentar }) {
  const google = useConexionGoogle()
  const [reintentando, setReintentando] = useState(false)

  if (!google.conectado) return null
  const sync = tarea.google_sync ?? 'ninguno'

  if (sync === 'ok' && tarea.google_event_id) {
    const enlace = enlaceEventoGoogle(tarea.google_event_id, google.email)
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <IconoGoogle className="size-3.5" />
        {enlace ? (
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Abrir en Google Calendar
          </a>
        ) : (
          'En Google Calendar'
        )}
      </p>
    )
  }

  if (sync !== 'pendiente' && sync !== 'error') return null

  async function reintentar() {
    setReintentando(true)
    try {
      await onReintentar()
    } finally {
      setReintentando(false)
    }
  }

  return (
    <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-800 dark:text-amber-300">
      <span className="flex items-center gap-1.5">
        <IconoGoogle className="size-3.5" />
        {sync === 'error'
          ? tarea.google_sync_error || 'No se pudo añadir a Google Calendar.'
          : 'Aún no está en Google Calendar.'}
      </span>
      {onReintentar && (
        <button
          type="button"
          onClick={reintentar}
          disabled={reintentando}
          className="font-medium underline disabled:no-underline disabled:opacity-60"
        >
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    </p>
  )
}
