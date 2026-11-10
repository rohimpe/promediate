import { useState } from 'react'
import { LARGO_MAXIMO_NOMBRE_CARPETA, MENSAJES_CARPETA, validarNombreCarpeta } from '../../lib/archivos'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Campo para el nombre de una carpeta (crear o renombrar). Enter confirma, Esc cancela.
//   inicial:     texto con el que empieza (al renombrar, el nombre actual)
//   onConfirmar(nombre): async; devuelve null si salió bien o el estado del error ('duplicada', 'reconectar'…)
//   onCancelar():        cerrar sin hacer nada
export default function CampoNombreCarpeta({ inicial = '', etiqueta, textoConfirmar, onConfirmar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function onSubmit(e) {
    e.preventDefault() // Enter dentro del campo
    const invalido = validarNombreCarpeta(nombre)
    if (invalido) return setError(MENSAJES_CARPETA[invalido])
    setOcupado(true)
    setError('')
    const estado = await onConfirmar(nombre.trim())
    // Si salió bien, quien lo usa cierra el campo (se desmonta): no hay que tocar el estado.
    if (estado) {
      setError(MENSAJES_CARPETA[estado] ?? MENSAJES_CARPETA.error)
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{etiqueta}</span>
        <input
          type="text"
          autoFocus
          maxLength={LARGO_MAXIMO_NOMBRE_CARPETA}
          disabled={ocupado}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => e.key === 'Escape' && !ocupado && onCancelar()}
          onFocus={(e) => e.target.select()}
          aria-invalid={error ? true : undefined}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
        />
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={ocupado}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {ocupado ? 'Guardando…' : textoConfirmar}
        </button>
        <button type="button" disabled={ocupado} onClick={onCancelar} className={BOTON}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
