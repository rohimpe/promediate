import { useId, useState } from 'react'
import { COLORES_CURSO } from '../lib/colores'
import CampoTexto from './CampoTexto'

// Formulario de curso: nombre y color. Sirve para crear y para editar.
//   inicial:   { nombre, color } al editar
//   onGuardar: recibe { nombre, color }; si falla, lanza un error
export default function CursoForm({ inicial, onGuardar, onCancelar, textoBoton }) {
  const uid = useId()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [color, setColor] = useState(inicial?.color ?? COLORES_CURSO[0].valor)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await onGuardar({ nombre: nombre.trim(), color })
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <CampoTexto
        id={`${uid}-nombre`}
        label="Nombre del curso"
        type="text"
        required
        autoFocus
        maxLength={80}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      {/* Colores como radio buttons ocultos: accesibles con teclado */}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COLORES_CURSO.map((c) => (
            <label key={c.valor} className="cursor-pointer">
              <input
                type="radio"
                name={`${uid}-color`}
                value={c.valor}
                checked={color === c.valor}
                onChange={() => setColor(c.valor)}
                className="peer sr-only"
              />
              <span
                title={c.nombre}
                style={{ backgroundColor: c.valor }}
                className="block size-8 rounded-full ring-offset-2 ring-offset-white peer-checked:ring-2 peer-checked:ring-gray-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 dark:ring-offset-gray-900 dark:peer-checked:ring-gray-100"
              />
              <span className="sr-only">{c.nombre}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : textoBoton}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={onCancelar}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
