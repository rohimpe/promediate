import { useCallback } from 'react'
import { actividadesAElementos, buscarChoques, intervaloDeActividad } from '../lib/choques'
import { hoyEnLima } from '../lib/fechas'
import { rangoPendientesGoogle } from '../lib/seguimiento'
import { listarActividadesDelDia } from '../lib/tasksApi'
import { useAuth } from './useAuth'
import { cargarEventosGoogle } from './useGoogleEventos'

// Devuelve una función para ver qué se cruza con una actividad ANTES de guardarla:
//   const comprobar = useComprobarChoques()
//   const choques = await comprobar({ fecha, horaInicio, horaFin, tarea })   // elementos que se solapan
//
//   tarea: la actividad que se edita (opcional); ella misma y su copia en Google no cuentan como choque.
//   excluirGoogleId: id en Google de un evento de Google que se está editando (opcional): no choca consigo mismo.
//
// Compara con las actividades de la app de ese día y con los eventos de Google. Para Google reutiliza lo que ya
// cargó el hook compartido (mismo rango que Inicio, Hoy y Pendientes, con su caché de 5 minutos); solo si la fecha
// cae fuera de ese rango pide ese día. Si Google no está conectado o falla, compara solo con la app.
// Nunca lanza error: si algo falla, simplemente no hay choques que mostrar (la advertencia no bloquea).
export function useComprobarChoques() {
  const { user } = useAuth()
  const userId = user?.id

  return useCallback(
    async ({ fecha, horaInicio, horaFin, tarea, excluirGoogleId = null }) => {
      const compartido = rangoPendientesGoogle(hoyEnLima())
      const rango = fecha >= compartido.desde && fecha <= compartido.hasta ? compartido : { desde: fecha, hasta: fecha }

      const [filas, google] = await Promise.all([
        listarActividadesDelDia(fecha).catch(() => []), // el error ya se registró en consola
        userId ? cargarEventosGoogle(userId, rango.desde, rango.hasta).catch(() => null) : null,
      ])

      return buscarChoques(
        intervaloDeActividad(fecha, horaInicio, horaFin),
        [...actividadesAElementos(filas), ...(google?.eventos ?? [])],
        { excluirId: tarea?.id ?? null, excluirGoogleId: excluirGoogleId ?? tarea?.google_event_id ?? null },
      )
    },
    [userId],
  )
}
