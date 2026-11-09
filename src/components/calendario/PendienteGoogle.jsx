import { useState } from 'react'
import { infoSeguimiento } from '../../lib/seguimiento'
import AccionesSeguido from '../AccionesSeguido'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Parte del panel de un evento de Google que permite seguirlo y marcarlo.
//   evento:       evento del calendario (origen 'google'), ya con el estado de su seguimiento
//   seguimiento:  lo que devuelve useSeguimientoGoogle()
//
// - No seguido: "Seguir este evento" y, si es de una serie, "Seguir toda la serie".
// - Seguido: Fui / Justificar / Deshacer (como en los pendientes) y "Dejar de seguir".
export default function SeguimientoGoogle({ evento, seguimiento }) {
  const { fila, porSerie, seguido } = infoSeguimiento(evento, seguimiento.porId, seguimiento.seriesSeguidas)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function ejecutar(accion) {
    setError('')
    setOcupado(true)
    try {
      await accion()
    } catch {
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  function dejarDeSeguir() {
    if (fila && fila.estado !== 'pendiente') {
      const hecho = fila.estado === 'completada' ? 'completado' : 'justificado'
      if (!window.confirm(`Ya lo marcaste como ${hecho}. Si dejas de seguirlo, se pierde esa marca. ¿Continuar?`)) return
    }
    ejecutar(() => seguimiento.dejarDeSeguir(evento))
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      {seguido && (
        <AccionesSeguido seguido={{ ...evento, justificacion: fila?.justificacion ?? null }} seguimiento={seguimiento} />
      )}

      <div className="flex flex-wrap gap-2">
        {!seguido && (
          <button type="button" disabled={ocupado} onClick={() => ejecutar(() => seguimiento.seguirEvento(evento))} className={BOTON}>
            Seguir este evento
          </button>
        )}
        {evento.serieId && !porSerie && (
          <button type="button" disabled={ocupado} onClick={() => ejecutar(() => seguimiento.seguirSerie(evento))} className={BOTON}>
            Seguir toda la serie
          </button>
        )}
        {porSerie ? (
          <button type="button" disabled={ocupado} onClick={() => ejecutar(() => seguimiento.dejarDeSeguirSerie(evento))} className={BOTON}>
            Dejar de seguir la serie
          </button>
        ) : (
          fila && (
            <button type="button" disabled={ocupado} onClick={dejarDeSeguir} className={BOTON}>
              Dejar de seguir
            </button>
          )
        )}
      </div>

      {porSerie && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Sigues toda la serie. Si dejas de seguirla, lo que ya marcaste se conserva.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
