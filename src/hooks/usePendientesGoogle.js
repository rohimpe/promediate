import { useMemo } from 'react'
import { combinarEventosGoogle } from '../lib/seguimiento'
import { useGoogleEventos } from './useGoogleEventos'

// Los eventos de Google que son pendientes dentro de un rango de días, listos para mostrar (Hoy, Pendientes, Inicio).
//   seguimiento: lo que devuelve useSeguimientoGoogle() (la página lo crea una sola vez y lo comparte)
//   rango:       { desde, hasta } ('YYYY-MM-DD' de Lima, ambos incluidos). Inicio, Hoy y Pendientes usan el mismo
//                (rangoPendientesGoogle), así que comparten UNA sola petición a Google gracias a la caché y a las
//                llamadas compartidas de useGoogleEventos.
//   activo:      false para no llamar a Google (p. ej. la pestaña "Google" de Pendientes está cerrada)
//   const { eventos, estadoGoogle, cargando, errorGoogle } = usePendientesGoogle(seguimiento, rango, activo)
//
// Si Google no está disponible (no conectado, reconectar…), `eventos` solo trae las filas ya guardadas.
export function usePendientesGoogle(seguimiento, rango, activo = true) {
  const { filas, reglas, cargando: cargandoSeguimiento } = seguimiento
  const { desde, hasta } = rango

  const google = useGoogleEventos(rango, activo && !cargandoSeguimiento)

  const eventos = useMemo(
    () =>
      combinarEventosGoogle(filas, reglas, google.eventos, {
        estadoGoogle: google.estado,
        truncado: google.truncado,
        rango: { desde, hasta },
      }),
    [filas, reglas, google.eventos, google.estado, google.truncado, desde, hasta],
  )

  return {
    eventos,
    estadoGoogle: google.estado, // 'ok', 'no_conectado', 'reconectar', 'permisos_incompletos' o null (sin respuesta)
    // Solo mientras no hay ninguna respuesta (después, al refrescar, se siguen mostrando los datos anteriores).
    cargando: cargandoSeguimiento || (activo && google.cargando && google.estado === null),
    errorGoogle: google.error,
  }
}
