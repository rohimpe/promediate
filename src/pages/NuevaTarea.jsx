import { useNavigate } from 'react-router'
import PendienteForm from '../components/PendienteForm'
import { crearTarea } from '../lib/tasksApi'

export default function NuevaTarea() {
  const navigate = useNavigate()

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Nuevo pendiente</h1>
      <PendienteForm onGuardar={crearTarea} onGuardado={() => navigate('/tareas')} />
    </>
  )
}
