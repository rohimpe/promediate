import { useId, useState } from 'react'
import CampoTexto from './CampoTexto'

const MAXIMO = 50

// Crea N subdivisiones que se reparten el peso del grupo en partes iguales.
// Ej.: nombre base "Laboratorio" y cantidad 6 -> Laboratorio 1 ... Laboratorio 6.
//   nombreInicial: nombre base propuesto
//   desde:         número con el que empieza la numeración (si el grupo ya tiene hijos)
//   onGuardar(base, cantidad): si falla, lanza un error
export default function FormIguales({ nombreInicial = '', desde = 1, onGuardar, onCancelar }) {
  const uid = useId()
  const [base, setBase] = useState(nombreInicial)
  const [cantidad, setCantidad] = useState('2')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const n = Number(cantidad)
  const valida = Number.isInteger(n) && n >= 1 && n <= MAXIMO

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!valida) return setError(`La cantidad debe ser un número entero entre 1 y ${MAXIMO}.`)
    setEnviando(true)
    try {
      await onGuardar(base.trim(), n)
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <CampoTexto
          id={`${uid}-base`}
          label="Nombre base"
          type="text"
          required
          autoFocus
          maxLength={70}
          value={base}
          onChange={(e) => setBase(e.target.value)}
        />
        <CampoTexto
          id={`${uid}-cantidad`}
          label="Cantidad"
          type="number"
          inputMode="numeric"
          min="1"
          max={MAXIMO}
          step="1"
          required
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </div>
      {valida && base.trim() && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Se crearán: {base.trim()} {desde}
          {n > 1 && ` … ${base.trim()} ${desde + n - 1}`}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {enviando ? 'Creando…' : `Crear ${valida ? n : 'N'} subdivisiones iguales`}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={onCancelar}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
