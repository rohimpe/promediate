import { useState } from 'react'
import { Link } from 'react-router'
import { useCourses } from '../hooks/useCourses'
import { aInputDatetime, deInputDatetime } from '../lib/fechas'
import { recortarHora } from '../lib/tipos'
import { Atajos, AtajosFecha } from './Atajos'
import CampoSelect from './CampoSelect'
import CampoTexto from './CampoTexto'
import SelectorHora from './SelectorHora'
import SelectorTipo from './SelectorTipo'

// Hora límite que se propone en las entregas nuevas.
const HORA_POR_DEFECTO = '23:59'

// Formulario compartido por "Nuevo pendiente" y "Editar pendiente".
//   inicial:   el pendiente a editar (o undefined si es nuevo)
//   onGuardar: recibe los campos listos para Supabase; si falla, lanza un error
export default function TareaForm({ inicial, onGuardar }) {
  const { cursos } = useCourses()
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'tarea')
  const [cursoId, setCursoId] = useState(inicial?.course_id ?? '')
  const [prioridadBase, setPrioridadBase] = useState(inicial?.prioridad_base ?? 'media')
  // La fecha límite se guarda como un solo instante (timestamptz), pero en el formulario
  // la separamos en día + hora. aInputDatetime la convierte a hora de Lima: 'YYYY-MM-DDTHH:mm'.
  const entregaInicial = aInputDatetime(inicial?.fecha_entrega)
  const [fechaEntrega, setFechaEntrega] = useState(entregaInicial.slice(0, 10))
  const [horaEntrega, setHoraEntrega] = useState(entregaInicial.slice(11) || HORA_POR_DEFECTO)
  const [fechaActividad, setFechaActividad] = useState(inicial?.fecha_actividad ?? '')
  const [horaInicio, setHoraInicio] = useState(recortarHora(inicial?.hora_inicio))
  const [horaFin, setHoraFin] = useState(recortarHora(inicial?.hora_fin))
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esEntrega = tipo === 'tarea'

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!esEntrega) {
      if (!horaInicio || !horaFin) {
        setError('Elige la hora de inicio y la hora de fin.')
        return
      }
      if (horaFin <= horaInicio) {
        setError('La hora de fin debe ser posterior a la hora de inicio.')
        return
      }
    }

    setEnviando(true)
    try {
      // Los campos que no corresponden al tipo se guardan en null,
      // así al cambiar de tipo no quedan datos viejos.
      await onGuardar({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        tipo,
        prioridad_base: prioridadBase,
        course_id: esEntrega ? cursoId || null : null,
        fecha_entrega: esEntrega ? deInputDatetime(`${fechaEntrega}T${horaEntrega}`) : null,
        fecha_actividad: esEntrega ? null : fechaActividad,
        hora_inicio: esEntrega ? null : horaInicio,
        hora_fin: esEntrega ? null : horaFin,
      })
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setEnviando(false)
    }
    // Si todo sale bien, la página que nos usa navega a otro lado.
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <SelectorTipo valor={tipo} onChange={setTipo} />

      <CampoTexto
        id="titulo"
        label="Título"
        type="text"
        required
        maxLength={150}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />

      <div>
        <label htmlFor="descripcion" className="mb-1 block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          id="descripcion"
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950"
        />
      </div>

      {esEntrega ? (
        <>
          <CampoSelect id="curso" label="Curso (opcional)" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
            <option value="">Sin curso</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </CampoSelect>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <CampoTexto
                id="fecha-entrega"
                label="Fecha límite"
                type="date"
                required
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
              <AtajosFecha onElegir={setFechaEntrega} />
            </div>
            <div>
              <SelectorHora id="hora-entrega" label="Hora límite (hora de Lima)" valor={horaEntrega} onChange={setHoraEntrega} />
              <Atajos atajos={[{ texto: '23:59', valor: HORA_POR_DEFECTO }]} onElegir={setHoraEntrega} />
            </div>
          </div>
        </>
      ) : (
        <>
          <CampoTexto
            id="fecha-actividad"
            label="Fecha"
            type="date"
            required
            value={fechaActividad}
            onChange={(e) => setFechaActividad(e.target.value)}
          />
          <AtajosFecha onElegir={setFechaActividad} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectorHora id="hora-inicio" label="Hora de inicio" valor={horaInicio} onChange={setHoraInicio} vacio />
            <SelectorHora id="hora-fin" label="Hora de fin" valor={horaFin} onChange={setHoraFin} vacio />
          </div>
        </>
      )}

      <CampoSelect
        id="prioridad"
        label="Prioridad base"
        value={prioridadBase}
        onChange={(e) => setPrioridadBase(e.target.value)}
      >
        <option value="alta">Alta</option>
        <option value="media">Media</option>
        <option value="baja">Baja</option>
      </CampoSelect>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : esEntrega ? 'Guardar entrega' : 'Guardar actividad'}
        </button>
        <Link
          to="/tareas"
          className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
