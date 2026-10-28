import { useEffect, useState } from 'react'
import { obtenerNombrePerfil } from '../lib/profileApi'

// Nombre guardado en profiles.nombre (null si no tiene o si falla la consulta).
// "cargando" evita mostrar primero el correo y luego cambiarlo por el nombre.
export function useNombrePerfil(userId) {
  const [nombre, setNombre] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!userId) return
    let activo = true
    obtenerNombrePerfil(userId)
      .then((n) => activo && setNombre(n))
      .catch(() => {}) // no es crítico: el saludo usa el correo
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [userId])

  return { nombre, cargando }
}
