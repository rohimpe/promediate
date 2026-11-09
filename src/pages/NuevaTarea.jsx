import { useNavigate } from 'react-router'
import PendienteForm from '../components/PendienteForm'
import { crearPendiente } from '../lib/googleSync'

export default function NuevaTarea() {
  const navigate = useNavigate()

  // crearPendiente espera a Google antes de volver a Pendientes: así la lista ya muestra si se sincronizó.
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Nuevo pendiente</h1>
      <PendienteForm onGuardar={crearPendiente} onGuardado={() => navigate('/tareas')} />
    </>
  )
}
