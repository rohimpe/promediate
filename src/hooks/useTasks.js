import { useCallback, useEffect, useRef, useState } from 'react'
import { borrarPendiente, cambiaElEvento, estaEnGoogle, sincronizarTarea } from '../lib/googleSync'
import { actualizarTarea, crearTarea, listarTareas } from '../lib/tasksApi'

// Carga los pendientes del usuario y permite crearlos, borrarlos o cambiarles campos.
//   const { tareas, cargando, error, crear, borrar, cambiar, sincronizar } = useTasks()
//
// Google Calendar (Fase 3, parte C): el pendiente se guarda siempre primero y después se avisa a Google en segundo
// plano; cuando responde, la lista se actualiza con el estado (google_sync) sin recargar.
//   crear(campos, { anadirAGoogle })  crea el evento si anadirAGoogle es true
//   cambiar(id, campos)               si el pendiente está en Google y cambia algo del evento, lo actualiza
//   borrar(id)                        borra antes el evento; devuelve { eventoQuedo } (true si pudo quedar en Google)
//   sincronizar(id, accion)           "Reintentar": vuelve a llamar a Google
export function useTasks() {
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // La lista más reciente, para saber cómo estaba un pendiente antes de cambiarlo sin depender de `tareas`.
  const tareasRef = useRef(tareas)
  useEffect(() => {
    tareasRef.current = tareas
  }, [tareas])

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

  const mezclar = useCallback((id, campos) => {
    setTareas((actuales) => actuales.map((t) => (t.id === id ? { ...t, ...campos } : t)))
  }, [])

  const sincronizar = useCallback(
    async (id, accion) => {
      const { estado, cambios } = await sincronizarTarea(accion, id)
      if (cambios) mezclar(id, cambios)
      return estado
    },
    [mezclar],
  )

  // Crea un pendiente en Supabase y lo agrega a la lista en pantalla (sin recargar).
  const crear = useCallback(
    async (campos, { anadirAGoogle = false } = {}) => {
      const nueva = await crearTarea(anadirAGoogle ? { ...campos, google_sync: 'pendiente' } : campos)
      setTareas((actuales) => [...actuales, nueva])
      if (anadirAGoogle) sincronizar(nueva.id, 'crear') // sin esperar: el modal se cierra ya
    },
    [sincronizar],
  )

  const borrar = useCallback(async (id) => {
    const tarea = tareasRef.current.find((t) => t.id === id) ?? { id }
    const resultado = await borrarPendiente(tarea)
    setTareas((actuales) => actuales.filter((t) => t.id !== id))
    return resultado
  }, [])

  // Guarda los cambios en Supabase y, si salió bien, también en la lista en pantalla.
  const cambiar = useCallback(
    async (id, campos) => {
      const antes = tareasRef.current.find((t) => t.id === id)
      await actualizarTarea(id, campos)
      mezclar(id, campos)
      // Completar, justificar o deshacer cambian el prefijo y el color del evento en Google.
      if (antes && estaEnGoogle(antes) && cambiaElEvento(campos)) sincronizar(id, 'actualizar')
    },
    [mezclar, sincronizar],
  )

  return { tareas, cargando, error, crear, borrar, cambiar, sincronizar }
}
