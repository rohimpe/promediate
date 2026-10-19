import { useNavigate } from 'react-router'
import TareaForm from '../components/TareaForm'
import { crearTarea } from '../lib/tasksApi'

export default function NuevaTarea() {
  const navigate = useNavigate()

  async function guardar(campos) {
    await crearTarea(campos)
    navigate('/tareas')
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Nuevo pendiente</h1>
      <TareaForm onGuardar={guardar} />
    </>
  )
}
