import { useState } from 'react'

// Botones de una tarjeta del checklist: Completar / Justificar / Deshacer.
//   onCompletar(), onJustificar(motivo), onDeshacer(): funciones async de la página;
//   si fallan lanzan un error y aquí mostramos el aviso.
export default function AccionesChecklist({ tarea, onCompletar, onJustificar, onDeshacer }) {
  const [justificando, setJustificando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  // Ejecuta una acción mostrando "ocupado" mientras espera y el error si falla.
  async function ejecutar(accion) {
    setError('')
    setOcupado(true)
    try {
      await accion()
    } catch {
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.')
      setOcupado(false)
    }
    // Si salió bien, la tarjeta cambia de lista y este componente se reemplaza.
  }

  const boton =
    'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60 border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

  // Ya cerrada: mostrar cómo se cerró y permitir deshacer.
  if (tarea.estado !== 'pendiente') {
    return (
      <div>
        {tarea.estado === 'justificada' && (
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Motivo:</span> {tarea.justificacion}
          </p>
        )}
        <button disabled={ocupado} onClick={() => ejecutar(onDeshacer)} className={boton}>
          Deshacer
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }

  if (justificando) {
    const motivoLimpio = motivo.trim()
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (motivoLimpio) ejecutar(() => onJustificar(motivoLimpio))
        }}
        className="space-y-2"
      >
        <label htmlFor={`motivo-${tarea.id}`} className="block text-sm font-medium">
          Motivo (obligatorio)
        </label>
        <textarea
          id={`motivo-${tarea.id}`}
          rows={2}
          required
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={ocupado || !motivoLimpio}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Guardar justificación
          </button>
          <button type="button" disabled={ocupado} onClick={() => setJustificando(false)} className={boton}>
            Cancelar
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          disabled={ocupado}
          onClick={() => ejecutar(onCompletar)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          ✓ Completar
        </button>
        <button disabled={ocupado} onClick={() => setJustificando(true)} className={boton}>
          Justificar
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
