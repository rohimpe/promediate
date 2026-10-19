import { useEffect, useState } from 'react'
import { listarCursos } from '../lib/tasksApi'

// Carga los cursos del usuario (para elegir uno en el formulario de tareas).
export function useCourses() {
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    listarCursos()
      .then((data) => activo && setCursos(data))
      .catch(() => {}) // si falla, el curso (opcional) simplemente no aparece
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  return { cursos, cargando }
}
