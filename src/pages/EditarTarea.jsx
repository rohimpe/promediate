import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import TareaForm from '../components/TareaForm'
import { actualizarTarea, obtenerTarea } from '../lib/tasksApi'

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

  async function guardar(campos) {
    await actualizarTarea(id, campos)
    navigate('/tareas')
  }

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
      <TareaForm inicial={tarea} onGuardar={guardar} />
    </>
  )
}
