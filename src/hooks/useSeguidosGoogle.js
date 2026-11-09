import { useMemo } from 'react'
import { fechaEnLima } from '../lib/fechas'
import { combinarSeguidos } from '../lib/seguimiento'
import { useGoogleEventos } from './useGoogleEventos'

// Lo que el usuario sigue de Google dentro de un rango de días, listo para mostrar (Hoy, Pendientes, Inicio).
//   seguimiento: lo que devuelve useSeguimientoGoogle() (la página lo crea una sola vez y lo comparte)
//   rango:       { desde, hasta } ('YYYY-MM-DD' de Lima, ambos incluidos)
//   activo:      false para no llamar a Google (p. ej. la pestaña "Google" de Pendientes está cerrada)
//   const { seguidos, estadoGoogle, cargando } = useSeguidosGoogle(seguimiento, rango, activo)
//
// A Google solo se le pregunta si hace falta: si hay series seguidas (sus ocurrencias salen de Google)
// o filas guardadas dentro del rango (para saber si Google sigue disponible y poner la nota "(guardado)").
// Las filas guardadas se muestran siempre, incluso si Google está desconectado.
export function useSeguidosGoogle(seguimiento, rango, activo = true) {
  const { filas, series, cargando: cargandoSeguimiento } = seguimiento
  const { desde, hasta } = rango

  const hayQuePreguntar = useMemo(
    () =>
      series.length > 0 ||
      filas.some((f) => {
        const dia = fechaEnLima(f.inicio)
        return dia >= desde && dia <= hasta
      }),
    [series, filas, desde, hasta],
  )

  const google = useGoogleEventos(rango, activo && !cargandoSeguimiento && hayQuePreguntar)

  const seguidos = useMemo(
    () =>
      combinarSeguidos(filas, series, google.eventos, {
        estadoGoogle: google.estado,
        truncado: google.truncado,
        rango: { desde, hasta },
      }),
    [filas, series, google.eventos, google.estado, google.truncado, desde, hasta],
  )

  return {
    seguidos,
    estadoGoogle: google.estado, // 'ok', 'no_conectado', 'reconectar', 'permisos_incompletos' o null (sin respuesta)
    // Solo mientras no hay ninguna respuesta (después, al refrescar, se siguen mostrando los datos anteriores).
    cargando: cargandoSeguimiento || (google.cargando && google.estado === null),
    errorGoogle: google.error,
  }
}
