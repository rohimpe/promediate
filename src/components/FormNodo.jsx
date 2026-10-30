import { useId, useState } from 'react'
import { formatearNumero } from '../lib/arbol'
import CampoTexto from './CampoTexto'

// Formulario pequeño para crear o editar un nodo del árbol (nombre y peso).
// Las notas no se ponen aquí: se escriben en la propia prueba (ver NotaEditable).
//   inicial:       { nombre, peso } al editar
//   pesoSugerido:  peso que se propone al crear (lo que falta para completar el nivel)
//   conPeso:       false si el padre reparte en partes iguales (el peso se calcula solo)
//   padreNombre:   nombre del padre (undefined en el primer nivel)
//   aportePadre:   aporte del padre al curso, en % (100 en el primer nivel); sirve para mostrar
//                  en vivo cuánto del curso vale el peso que se escribe
//   onGuardar:     recibe { nombre, peso? }; si falla, lanza un error
export default function FormNodo({
  inicial,
  pesoSugerido = '',
  conPeso = true,
  padreNombre,
  aportePadre = 100,
  onGuardar,
  onCancelar,
  textoBoton,
}) {
  const uid = useId()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [peso, setPeso] = useState(String(inicial?.peso ?? pesoSugerido))
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    const pesoNum = Number(peso)
    if (conPeso && !(pesoNum >= 0 && pesoNum <= 100)) return setError('El peso debe estar entre 0 y 100.')

    setEnviando(true)
    try {
      await onGuardar(conPeso ? { nombre: nombre.trim(), peso: pesoNum } : { nombre: nombre.trim() })
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setEnviando(false)
    }
    // Si sale bien, quien nos usa cierra el formulario.
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <CampoTexto
        id={`${uid}-nombre`}
        label="Nombre"
        type="text"
        required
        autoFocus
        maxLength={80}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      {conPeso && (
        <div>
          <CampoTexto
            id={`${uid}-peso`}
            label={padreNombre ? `Peso (% de ${padreNombre})` : 'Peso (% del curso)'}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            required
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
          {/* En el primer nivel el equivalente es el mismo número, así que no se muestra. */}
          {padreNombre && peso !== '' && Number.isFinite(Number(peso)) && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              = {formatearNumero((Number(peso) * aportePadre) / 100)}% del curso
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : textoBoton}
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
