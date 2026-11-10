// Lo que comparten google-calendar-events (leer) y google-calendar-editar (editar): cómo se normaliza un evento
// de Google para el frontend y la regla de quién puede editarlo desde la app.
//
// Nunca salen de aquí la descripción ni la lista de asistentes: solo un booleano `editable` y el motivo.
import { ORIGEN_APP } from './google.ts'

// Campos que se piden a Google para UN evento (events.get / events.patch). events.list usa los mismos dentro de
// items(...). Así la descripción y los datos de los invitados ni siquiera salen de Google.
export const CAMPOS_EVENTO =
  'id,etag,recurringEventId,status,summary,colorId,start,end,location,htmlLink,organizer(self),attendees(self,responseStatus),extendedProperties(private)'

export interface EventoGoogle {
  id?: string
  etag?: string
  recurringEventId?: string
  status?: string
  summary?: string
  colorId?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  location?: string
  htmlLink?: string
  organizer?: { self?: boolean }
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}

// Por qué un evento NO se puede editar desde la app (null = sí se puede):
//   'app'          lo creó esta app: se edita desde su pendiente (google-calendar-sync)
//   'invitados'    lo organizas tú, pero tiene invitados: cambiarlo sin avisarles (sendUpdates = 'none') los confundiría
//   'organizador'  lo organiza otra persona y tú eres invitado
// Regla: se puede editar si no lo creó la app y no tiene asistentes aparte del propio usuario. Un evento sin otros
// asistentes se puede editar aunque `organizer.self` no sea true (p. ej. creado por otra app en tu calendario).
export type MotivoNoEditable = 'app' | 'invitados' | 'organizador'

export function motivoNoEditable(e: EventoGoogle, idsDeLaApp?: Set<string>): MotivoNoEditable | null {
  if (e.extendedProperties?.private?.origen === ORIGEN_APP) return 'app'
  if (e.id && idsDeLaApp?.has(e.id)) return 'app'
  const otrosAsistentes = (e.attendees ?? []).some((a) => a.self !== true)
  if (otrosAsistentes) return e.organizer?.self === true ? 'invitados' : 'organizador'
  return null
}

// El evento en el formato que entiende el frontend (googleAEventos, src/lib/calendario.js).
//   con hora:       inicio y fin son instantes ISO con su offset original
//   de todo el día: inicio y fin son 'YYYY-MM-DD' y `fin` es EXCLUSIVO (como lo manda Google)
export function normalizarEvento(e: EventoGoogle, idsDeLaApp?: Set<string>) {
  const todoElDia = !!e.start?.date && !e.start?.dateTime
  const inicio = (todoElDia ? e.start?.date : e.start?.dateTime) as string
  const fin = (todoElDia ? e.end?.date : e.end?.dateTime) ?? inicio
  const motivo = motivoNoEditable(e, idsDeLaApp)
  return {
    id: e.id as string,
    serieId: e.recurringEventId ?? null, // id de la serie repetitiva (null si el evento es suelto)
    titulo: e.summary?.trim() || 'Sin título',
    colorId: e.colorId ?? null, // '1'…'11' si el usuario le puso color en Google; null = color del calendario
    inicio,
    fin,
    todoElDia,
    lugar: e.location?.trim() || null,
    enlace: e.htmlLink ?? null,
    etag: e.etag ?? null, // versión del evento: google-calendar-editar la exige para no pisar cambios hechos en Google
    editable: motivo === null,
    motivoNoEditable: motivo,
    origen: 'google',
  }
}
