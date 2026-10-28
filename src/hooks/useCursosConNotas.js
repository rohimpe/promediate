import { useEffect, useMemo, useState } from 'react'
import { cursosConResultado } from '../lib/inicio'
import { listarCursosConEvaluaciones } from '../lib/promediosApi'

// Carga los cursos del usuario con su nota final, en UNA sola consulta.
//   const { cursos, cargando, error } = useCursosConNotas()
// Cada curso trae { id, nombre, color, resultado } (resultado es null si no tiene evaluaciones).
export function useCursosConNotas() {
  const [crudos, setCrudos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    listarCursosConEvaluaciones()
      .then((data) => activo && setCrudos(data))
      .catch(() => activo && setError('No se pudieron cargar los cursos.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const cursos = useMemo(() => cursosConResultado(crudos), [crudos])
  return { cursos, cargando, error }
}
