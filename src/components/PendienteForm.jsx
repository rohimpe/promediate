import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useCourses } from '../hooks/useCourses'
import { aInputDatetime, deInputDatetime } from '../lib/fechas'
import { HORA_ENTREGA_POR_DEFECTO, recortarHora } from '../lib/tipos'
import { Atajos, AtajosFecha } from './Atajos'
import CampoSelect from './CampoSelect'
import CampoTexto from './CampoTexto'
import SelectorHora from './SelectorHora'
import SelectorTipo from './SelectorTipo'

// Formulario de pendientes. Lo usan "Nuevo pendiente", "Editar pendiente" y el modal
// de creación rápida del calendario.
//
//   inicial:            el pendiente a editar (o undefined si es nuevo)
//   valoresIniciales:   para un pendiente nuevo, todo opcional:
//                       { tipo: 'tarea' | 'actividad', fecha: 'YYYY-MM-DD', horaEntrega, horaInicio,
//                         horaFin, cursoId }. `fecha` sirve para los dos tipos, así no se pierde al
//                       cambiar de tipo.
//   onGuardar(campos):  guarda en Supabase (quien usa el formulario decide cómo); si falla, lanza el error
//   onGuardado:         se llama cuando onGuardar terminó bien (navegar, cerrar el modal…)
//   onCancelar:         si se pasa, "Cancelar" es un botón que lo llama; si no, vuelve a Pendientes
//   onEstado:           opcional, debe ser estable. Recibe { sucio, enviando } cada vez que cambian:
//                       "sucio" = el usuario ya escribió un título o una descripción.
export default function PendienteForm({ inicial, valoresIniciales, onGuardar, onGuardado, onCancelar, onEstado }) {
  const { cursos } = useCourses()
  const v = valoresIniciales ?? {}
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo ?? v.tipo ?? 'tarea')
  const [cursoId, setCursoId] = useState(inicial?.course_id ?? v.cursoId ?? '')
  const [prioridadBase, setPrioridadBase] = useState(inicial?.prioridad_base ?? 'media')
  // La fecha límite se guarda como un solo instante (timestamptz), pero en el formulario
  // la separamos en día + hora. aInputDatetime la convierte a hora de Lima: 'YYYY-MM-DDTHH:mm'.
  const entregaInicial = aInputDatetime(inicial?.fecha_entrega)
  const [fechaEntrega, setFechaEntrega] = useState(entregaInicial.slice(0, 10) || v.fecha || '')
  const [horaEntrega, setHoraEntrega] = useState(entregaInicial.slice(11) || v.horaEntrega || HORA_ENTREGA_POR_DEFECTO)
  const [fechaActividad, setFechaActividad] = useState(inicial?.fecha_actividad ?? v.fecha ?? '')
  const [horaInicio, setHoraInicio] = useState(recortarHora(inicial?.hora_inicio) || v.horaInicio || '')
  const [horaFin, setHoraFin] = useState(recortarHora(inicial?.hora_fin) || v.horaFin || '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esEntrega = tipo === 'tarea'
  const sucio = titulo.trim() !== '' || descripcion.trim() !== ''

  // Si el formulario se cierra mientras guarda, no tocamos su estado ni llamamos onGuardado.
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    onEstado?.({ sucio, enviando })
  }, [sucio, enviando, onEstado])

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
    } catch (err) {
      // Todo lo escrito se conserva; solo mostramos el error de verdad (el de Supabase o de red).
      if (montado.current) {
        setError(err?.message ? `No se pudo guardar: ${err.message}` : 'No se pudo guardar. Inténtalo de nuevo.')
        setEnviando(false)
      }
      return
    }
    if (!montado.current) return
    setEnviando(false)
    onGuardado?.()
  }

  const clasesCancelar =
    'rounded-lg border border-gray-300 px-4 py-2.5 font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

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
              <Atajos atajos={[{ texto: '23:59', valor: HORA_ENTREGA_POR_DEFECTO }]} onElegir={setHoraEntrega} />
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
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className={clasesCancelar}>
            Cancelar
          </button>
        ) : (
          <Link to="/tareas" className={clasesCancelar}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  )
}
