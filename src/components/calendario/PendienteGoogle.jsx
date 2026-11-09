import { useState } from 'react'
import { entraAPendientes } from '../../lib/seguimiento'
import AccionesEventoGoogle from '../AccionesEventoGoogle'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Parte del panel de un evento de Google que permite marcarlo y quitarlo de los pendientes.
//   evento:       evento del calendario (origen 'google'), ya con el estado de sus pendientes
//   seguimiento:  lo que devuelve useSeguimientoGoogle()
//
// Si el evento entra a pendientes: Fui / Justificar / Deshacer (como en los pendientes), "Quitar de mis
// pendientes" y, si es de una serie, "Quitar toda la serie". Si no entra (oculto, o de todo el día con el
// interruptor apagado), no muestra nada: es un evento de solo lectura.
export default function PendienteGoogle({ evento, seguimiento }) {
  const { reglas, filas } = seguimiento
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  if (!entraAPendientes(evento, reglas)) return null
  const fila = reglas.porId.get(evento.googleId) ?? null

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

  function quitar() {
    if (fila) {
      const hecho = fila.estado === 'completada' ? 'completado' : 'justificado'
      if (!window.confirm(`Ya lo marcaste como ${hecho}. Si lo quitas de tus pendientes, se pierde esa marca. ¿Continuar?`)) {
        return
      }
    }
    ejecutar(() => seguimiento.quitarEvento(evento))
  }

  function quitarSerie() {
    // Las marcas de las ocurrencias de la serie también se borran, así que se avisa si hay alguna.
    const marcadas = filas.filter((f) => f.serie_id === evento.serieId).length
    if (marcadas > 0) {
      const cuantas = marcadas === 1 ? 'Ya marcaste 1 evento' : `Ya marcaste ${marcadas} eventos`
      if (!window.confirm(`${cuantas} de esta serie. Si la quitas de tus pendientes, se pierden esas marcas. ¿Continuar?`)) {
        return
      }
    }
    ejecutar(() => seguimiento.quitarSerie(evento))
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      <AccionesEventoGoogle evento={{ ...evento, justificacion: fila?.justificacion ?? null }} seguimiento={seguimiento} />

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={quitar} className={BOTON}>
          Quitar de mis pendientes
        </button>
        {evento.serieId && (
          <button type="button" disabled={ocupado} onClick={quitarSerie} className={BOTON}>
            Quitar toda la serie
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
