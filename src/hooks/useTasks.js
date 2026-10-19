import { useCallback, useEffect, useState } from 'react'
import { borrarTarea, listarTareas } from '../lib/tasksApi'

// Carga las tareas del usuario y permite borrarlas.
//   const { tareas, cargando, error, borrar } = useTasks()
export function useTasks() {
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true // evita actualizar el estado si el componente ya se cerró
    listarTareas()
      .then((data) => activo && setTareas(data))
      .catch(() => activo && setError('No se pudieron cargar las tareas.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const borrar = useCallback(async (id) => {
    await borrarTarea(id)
    setTareas((actuales) => actuales.filter((t) => t.id !== id))
  }, [])

  return { tareas, cargando, error, borrar }
}
