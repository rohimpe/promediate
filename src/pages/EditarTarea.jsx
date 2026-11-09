import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import PendienteForm from '../components/PendienteForm'
import { actualizarPendiente } from '../lib/googleSync'
import { obtenerTarea } from '../lib/tasksApi'

export default function EditarTarea() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tarea, setTarea] = useState(null)
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'no-encontrada' | 'error'

  useEffect(() => {
    let activo = true
    obtenerTarea(id)
      .then((t) => {
        if (!activo) return
        setTarea(t)
        setEstado(t ? 'listo' : 'no-encontrada')
      })
      .catch(() => activo && setEstado('error'))
    return () => {
      activo = false
    }
  }, [id])

  // Guarda y, según el interruptor "Añadir a Google Calendar", crea, actualiza o borra el evento.
  const guardar = (campos, opciones) => actualizarPendiente(tarea, campos, opciones)

  if (estado === 'cargando') return <p className="text-gray-600 dark:text-gray-400">Cargando…</p>

  if (estado !== 'listo') {
    return (
      <>
        <p className="text-gray-600 dark:text-gray-400">
          {estado === 'error' ? 'No se pudo cargar el pendiente.' : 'Ese pendiente no existe.'}
        </p>
        <Link to="/tareas" className="mt-2 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Volver a Pendientes
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Editar pendiente</h1>
      <PendienteForm inicial={tarea} onGuardar={guardar} onGuardado={() => navigate('/tareas')} />
    </>
  )
}
