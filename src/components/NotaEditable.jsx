import { useState } from 'react'
import { formatearNumero } from '../lib/arbol'

const BOTON_CHICO =
  'rounded-md border border-gray-300 px-2 py-0.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

function MensajeError({ texto }) {
  if (!texto) return null
  return (
    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
      {texto}
    </p>
  )
}

// La nota de una prueba (hoja), editable en el mismo lugar:
//   sin nota: botón "+ Nota" que abre un campo numérico
//   con nota: chip clicable para corregirla, con una "×" para borrarla
// En el campo: Enter guarda, Esc cancela.
//   onGuardar(valor): recibe un número (0 a 20) o null para borrar; si falla, lanza un error
export default function NotaEditable({ nota, onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function empezar() {
    setTexto(nota == null ? '' : String(nota))
    setError('')
    setEditando(true)
  }

  async function guardar(valor) {
    setOcupado(true)
    setError('')
    try {
      await onGuardar(valor)
      setEditando(false)
    } catch {
      setError('No se pudo guardar.')
    }
    setOcupado(false)
  }

  function onSubmit(e) {
    e.preventDefault() // Enter dentro del campo
    if (texto.trim() === '') return setEditando(false)
    const valor = Number(texto)
    if (!(valor >= 0 && valor <= 20)) return setError('La nota va de 0 a 20.')
    guardar(valor)
  }

  if (editando) {
    return (
      <form onSubmit={onSubmit} className="mt-1">
        <div className="flex items-center gap-1.5">
          <input
            aria-label="Nota (0 a 20)"
            type="number"
            inputMode="decimal"
            min="0"
            max="20"
            step="any"
            autoFocus
            disabled={ocupado}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditando(false)}
            className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950"
          />
          <button type="submit" disabled={ocupado} aria-label="Guardar nota" className={BOTON_CHICO}>
            ✓
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setEditando(false)}
            aria-label="Cancelar"
            className={BOTON_CHICO}
          >
            ✕
          </button>
        </div>
        <MensajeError texto={error} />
      </form>
    )
  }

  if (nota == null) {
    return (
      <div className="mt-1">
        <button type="button" onClick={empezar} className={BOTON_CHICO}>
          + Nota
        </button>
        <MensajeError texto={error} />
      </div>
    )
  }

  return (
    <div className="mt-1">
      <span className="inline-flex items-center overflow-hidden rounded-full border border-gray-300 text-sm dark:border-gray-700">
        <button
          type="button"
          onClick={empezar}
          title="Corregir la nota"
          className="px-2.5 py-0.5 font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Nota: {formatearNumero(nota)}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => guardar(null)}
          aria-label="Borrar la nota"
          title="Borrar la nota"
          className="border-l border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          ×
        </button>
      </span>
      <MensajeError texto={error} />
    </div>
  )
}
