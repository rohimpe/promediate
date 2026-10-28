import { useCallback, useEffect, useState } from 'react'
import { actualizarTarea, borrarTarea, crearTarea, listarTareas } from '../lib/tasksApi'

// Carga los pendientes del usuario y permite crearlos, borrarlos o cambiarles campos.
//   const { tareas, cargando, error, crear, borrar, cambiar } = useTasks()
export function useTasks() {
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true // evita actualizar el estado si el componente ya se cerró
    listarTareas()
      .then((data) => activo && setTareas(data))
      .catch(() => activo && setError('No se pudieron cargar los pendientes.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  // Crea un pendiente en Supabase y lo agrega a la lista en pantalla (sin recargar).
  const crear = useCallback(async (campos) => {
    const nueva = await crearTarea(campos)
    setTareas((actuales) => [...actuales, nueva])
  }, [])

  const borrar = useCallback(async (id) => {
    await borrarTarea(id)
    setTareas((actuales) => actuales.filter((t) => t.id !== id))
  }, [])

  // Guarda los cambios en Supabase y, si salió bien, también en la lista en pantalla.
  const cambiar = useCallback(async (id, campos) => {
    await actualizarTarea(id, campos)
    setTareas((actuales) => actuales.map((t) => (t.id === id ? { ...t, ...campos } : t)))
  }, [])

  return { tareas, cargando, error, crear, borrar, cambiar }
}
