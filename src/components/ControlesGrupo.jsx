import { useId, useState } from 'react'
import { descartesEfectivos, esIguales } from '../lib/arbol'

const OPCION =
  'px-3 py-1 text-sm font-medium aria-pressed:bg-indigo-600 aria-pressed:text-white hover:bg-gray-100 aria-pressed:hover:bg-indigo-600 dark:hover:bg-gray-800 disabled:opacity-60'

// Campo "Descartar las N peores": se guarda al salir del campo o con Enter.
// N va de 0 a (hijos - 1); si se escribe otro número, se ajusta a ese rango.
function CampoDescarte({ nodo, onCambiar }) {
  const uid = useId()
  const n = nodo.hijos.length
  const actual = descartesEfectivos(nodo)
  const [texto, setTexto] = useState(String(actual))
  const [error, setError] = useState('')

  async function guardar() {
    const valor = Math.min(Math.max(0, Math.floor(Number(texto) || 0)), n - 1)
    setTexto(String(valor))
    if (valor === actual) return
    setError('')
    try {
      await onCambiar(valor)
    } catch {
      setError('No se pudo guardar.')
      setTexto(String(actual))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={uid}>Descartar las</label>
        <input
          id={uid}
          type="number"
          inputMode="numeric"
          min="0"
          max={n - 1}
          step="1"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur() // guarda al salir del campo
            }
          }}
          className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950"
        />
        <span>peores notas</span>
        <span className="text-gray-600 dark:text-gray-400">
          (cuentan las {n - actual} mejores de {n})
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

// Controles de un grupo (nodo con subdivisiones): cómo se reparte su peso y,
// en partes iguales, cuántas notas peores se descartan.
//   onCambiarReparto(reparto) · onCambiarDescarte(n): funciones async; si fallan lanzan un error
export default function ControlesGrupo({ nodo, onCambiarReparto, onCambiarDescarte }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const iguales = esIguales(nodo)

  async function cambiar(reparto) {
    if (reparto === nodo.reparto) return
    setOcupado(true)
    setError('')
    try {
      await onCambiarReparto(reparto)
    } catch {
      setError('No se pudo cambiar el reparto.')
    }
    setOcupado(false)
  }

  return (
    <div className="space-y-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Reparto:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
          <button type="button" disabled={ocupado} aria-pressed={!iguales} onClick={() => cambiar('manual')} className={OPCION}>
            Manual
          </button>
          <button
            type="button"
            disabled={ocupado}
            aria-pressed={iguales}
            onClick={() => cambiar('iguales')}
            className={`border-l border-gray-300 dark:border-gray-700 ${OPCION}`}
          >
            Partes iguales
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {iguales && nodo.hijos.length > 1 && (
        // "key": si cambia el valor guardado o la cantidad de hijos, el campo se reinicia con el valor nuevo.
        <CampoDescarte
          key={`${nodo.descartar_peores}-${nodo.hijos.length}`}
          nodo={nodo}
          onCambiar={onCambiarDescarte}
        />
      )}
    </div>
  )
}
