// Parte B de la Fase 3: lee los eventos del Google Calendar del usuario (solo lectura).
// El frontend manda { desde, hasta } y recibe los eventos ya normalizados y filtrados.
//
// Respuesta (siempre 200 salvo error): { estado, eventos, truncado }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos'
//   eventos: [{ id, titulo, inicio, fin, todoElDia, lugar, enlace, origen: 'google' }]
//     - con hora:       inicio y fin son instantes ISO con su offset original ("2026-11-10T09:00:00+01:00")
//     - de todo el día: inicio y fin son fechas 'YYYY-MM-DD' y `fin` es EXCLUSIVO (así las manda Google:
//                       un evento del 10 al 12 trae fin = 13)
//   truncado: true si había más eventos que el tope (MAX_EVENTOS) y se dejaron fuera
//
// Nunca se registran tokens ni contenido de eventos: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import { ErrorGoogle, obtenerAccessToken, registrarFallo } from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const URL_EVENTOS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.events'
const ORIGEN_APP = 'tablero-de-vida' // marca que la Parte C pondrá en los eventos que cree esta app

const MAX_DIAS = 100
const MS_POR_DIA = 86_400_000
const POR_PAGINA = 250
const MAX_EVENTOS = 1000

// Pedimos solo los campos que usamos (así la descripción, los asistentes completos y demás
// datos personales ni siquiera salen de Google).
const CAMPOS =
  'nextPageToken,items(id,status,summary,start,end,location,htmlLink,attendees(self,responseStatus),extendedProperties(private))'

interface EventoGoogle {
  id?: string
  status?: string
  summary?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  location?: string
  htmlLink?: string
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}

// Valida el rango y lo devuelve como instantes UTC ("…Z"), que es lo que Google acepta en timeMin/timeMax.
function leerRango(cuerpo: unknown): { desde: string; hasta: string } | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { desde, hasta } = cuerpo as Record<string, unknown>
  if (typeof desde !== 'string' || typeof hasta !== 'string') return null
  if (desde.length > 40 || hasta.length > 40) return null
  const d = new Date(desde)
  const h = new Date(hasta)
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) return null
  if (h <= d || h.getTime() - d.getTime() > MAX_DIAS * MS_POR_DIA) return null
  return { desde: d.toISOString(), hasta: h.toISOString() }
}

function respuestaSinEventos(req: Request, estado: string) {
  return responderJson(req, { estado, eventos: [], truncado: false })
}

// ¿Lo creó esta app, o el usuario lo rechazó, o está cancelado? Entonces no se muestra.
function sobra(e: EventoGoogle, idsDeLaApp: Set<string>): boolean {
  if (e.status === 'cancelled') return true
  if (e.attendees?.some((a) => a.self === true && a.responseStatus === 'declined')) return true
  if (e.extendedProperties?.private?.origen === ORIGEN_APP) return true
  if (e.id && idsDeLaApp.has(e.id)) return true
  return false
}

function normalizar(e: EventoGoogle) {
  const todoElDia = !!e.start?.date && !e.start?.dateTime
  const inicio = (todoElDia ? e.start?.date : e.start?.dateTime) as string
  const fin = (todoElDia ? e.end?.date : e.end?.dateTime) ?? inicio
  return {
    id: e.id as string,
    titulo: e.summary?.trim() || 'Sin título',
    inicio,
    fin,
    todoElDia,
    lugar: e.location?.trim() || null,
    enlace: e.htmlLink ?? null,
    origen: 'google',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    // Con verify_jwt activado, la puerta de Supabase ya revisó que haya un JWT; aquí lo
    // verificamos de nuevo contra Auth y sacamos el user_id (nunca se lee del cuerpo).
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const rango = leerRango(await req.json().catch(() => null))
    if (!rango) {
      return responderJson(req, { error: `Rango inválido (máximo ${MAX_DIAS} días)` }, 400)
    }

    // Estado de la conexión (sin tocar el refresh token todavía).
    const { data: conexion, error: errorConexion } = await supabaseAdmin
      .from('google_connections')
      .select('estado, scopes')
      .eq('user_id', userId)
      .maybeSingle()
    if (errorConexion) {
      registrarFallo('google-calendar-events: leer conexión', errorConexion.code)
      return responderJson(req, { error: 'No se pudieron cargar los eventos' }, 500)
    }
    if (!conexion) return respuestaSinEventos(req, 'no_conectado')
    if (conexion.estado === 'reconectar') return respuestaSinEventos(req, 'reconectar')
    // Google guarda los scopes concedidos como texto separado por espacios.
    if (!(conexion.scopes ?? '').split(' ').includes(SCOPE_CALENDAR)) {
      return respuestaSinEventos(req, 'permisos_incompletos')
    }

    let accessToken: string
    try {
      accessToken = await obtenerAccessToken(userId)
    } catch (e) {
      // obtenerAccessToken ya registró el fallo y, si fue invalid_grant, marcó 'reconectar'.
      if (e instanceof ErrorGoogle && e.codigo === 'invalid_grant') return respuestaSinEventos(req, 'reconectar')
      if (e instanceof ErrorGoogle && e.codigo === 'sin_conexion') return respuestaSinEventos(req, 'no_conectado')
      return responderJson(req, { error: 'No se pudieron cargar los eventos' }, 502)
    }

    // Eventos que esta app creó en Google (Parte C): se ven como pendientes, no como eventos de Google.
    const { data: filas, error: errorTareas } = await supabaseAdmin
      .from('tasks')
      .select('google_event_id')
      .eq('user_id', userId)
      .not('google_event_id', 'is', null)
    if (errorTareas) registrarFallo('google-calendar-events: leer google_event_id', errorTareas.code)
    const idsDeLaApp = new Set((filas ?? []).map((f) => f.google_event_id as string))

    const eventos: ReturnType<typeof normalizar>[] = []
    let recibidos = 0
    let truncado = false
    let pagina: string | undefined

    do {
      const parametros = new URLSearchParams({
        timeMin: rango.desde,
        timeMax: rango.hasta,
        singleEvents: 'true', // expande los eventos repetidos en ocurrencias sueltas
        orderBy: 'startTime',
        maxResults: String(POR_PAGINA),
        fields: CAMPOS,
      })
      if (pagina) parametros.set('pageToken', pagina)

      const respuesta = await fetch(`${URL_EVENTOS}?${parametros}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      })
      const cuerpo = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) {
        // Solo el código HTTP y el "reason" de Google (p. ej. accessNotConfigured), nunca datos.
        const motivo = typeof cuerpo?.error?.errors?.[0]?.reason === 'string' ? cuerpo.error.errors[0].reason : ''
        registrarFallo('google-calendar-events: events.list', `${respuesta.status} ${motivo}`.trim())
        return responderJson(req, { error: 'No se pudieron cargar los eventos' }, 502)
      }

      for (const e of (cuerpo.items ?? []) as EventoGoogle[]) {
        if (recibidos >= MAX_EVENTOS) {
          truncado = true
          break
        }
        recibidos++
        // Sin id o sin inicio no se puede dibujar: se ignora.
        if (!e.id || !(e.start?.date || e.start?.dateTime)) continue
        if (!sobra(e, idsDeLaApp)) eventos.push(normalizar(e))
      }
      pagina = truncado ? undefined : cuerpo.nextPageToken
      // Si justo se llegó al tope y aún hay otra página, hay eventos que no se pidieron.
      if (pagina && recibidos >= MAX_EVENTOS) {
        truncado = true
        pagina = undefined
      }
    } while (pagina)

    return responderJson(req, { estado: 'ok', eventos, truncado })
  } catch {
    registrarFallo('google-calendar-events')
    return responderJson(req, { error: 'No se pudieron cargar los eventos' }, 500)
  }
})
