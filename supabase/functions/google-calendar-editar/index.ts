// Parte C2 de la Fase 3: edita desde la app un evento que YA existía en el Google Calendar del usuario.
//
// Petición: { evento_id, alcance: 'este' | 'serie', cambios: { titulo?, inicio?, fin?, lugar? }, etag }
//   evento_id: id de la ocurrencia en Google (el `id` que devuelve google-calendar-events)
//   alcance:   'este' = solo esa ocurrencia · 'serie' = toda la serie (solo título y lugar)
//   cambios:   solo lo que cambió. Fechas en hora de pared de Lima:
//                con hora:       inicio y fin 'YYYY-MM-DDTHH:mm' (si cambia uno, se mandan los dos)
//                de todo el día: inicio y fin 'YYYY-MM-DD', con `fin` EXCLUSIVO (como en Google)
//              lugar '' lo borra.
//   etag:      versión del evento que vio el usuario. Si en Google ya es otra, no se toca nada ('conflicto').
//
// Respuesta (200): { estado, evento?, motivo? }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'no_editable' | 'conflicto' | 'error'
//   evento: (solo con 'ok') la ocurrencia ya editada, normalizada igual que en google-calendar-events (con su etag nuevo)
//   motivo: (solo con 'no_editable') 'app' | 'invitados' | 'organizador' | 'serie_horario' | 'sin_serie' | 'google'
//
// Reglas de seguridad:
//   - El user_id sale del JWT verificado contra Supabase Auth; el evento se lee con el token de ESE usuario.
//   - No se editan los eventos que creó esta app (se editan desde su pendiente) ni los que tienen otros asistentes.
//   - events.patch con If-Match (el etag) y sendUpdates = 'none': solo cambia lo pedido y nunca pisa un cambio
//     hecho en Google entretanto.
// Nunca se registran tokens ni contenido de eventos: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import { ErrorGoogle, obtenerAccessToken, registrarFallo, SCOPE_CALENDAR, URL_EVENTOS } from '../_shared/google.ts'
import { CAMPOS_EVENTO, type EventoGoogle, motivoNoEditable, normalizarEvento } from '../_shared/eventosGoogle.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const ZONA = 'America/Lima'

// Largos máximos (Google acepta más, pero esto sobra para un horario universitario).
const MAX_ID = 1024
const MAX_ETAG = 200
const MAX_TITULO = 300
const MAX_LUGAR = 500
const MAX_DIAS_EVENTO = 31 // un evento editado desde la app no puede durar más que esto

// Ids de Google: letras, números, '_' (las ocurrencias de una serie: "<id>_20261110T140000Z") y '-'.
const ID_EVENTO = /^[A-Za-z0-9_-]+$/
const ETAG = /^[\x21-\x7e]+$/ // ASCII visible: el etag de Google viene entre comillas ("\"3412…\"")
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
// Caracteres de control (saltos de línea, tabulaciones…): no tienen sentido en un título ni en un lugar.
const tieneControl = (texto: string) => [...texto].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)

type Estado = 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'no_editable' | 'conflicto' | 'error'

interface Cambios {
  titulo?: string
  inicio?: string
  fin?: string
  lugar?: string
}

interface Peticion {
  eventoId: string
  alcance: 'este' | 'serie'
  cambios: Cambios
  etag: string
}

// ¿Es una fecha real? ('2026-02-30' no lo es.) Se comprueba en UTC para que no influya ninguna zona.
function fechaValida(fecha: string): boolean {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2100
}

function horaValida(fechaHora: string): boolean {
  const [hh, mm] = fechaHora.slice(11).split(':').map(Number)
  return hh <= 23 && mm <= 59
}

// Días entre dos fechas 'YYYY-MM-DD' (b - a).
function diasEntre(a: string, b: string): number {
  const ms = (f: string) => {
    const [y, m, d] = f.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

// Valida tipos y largos. Devuelve null si algo no cuadra (la app nunca manda algo así: es una petición manipulada
// o un error de programación, así que basta un 400 genérico).
function leerPeticion(cuerpo: unknown): Peticion | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { evento_id, alcance, cambios, etag } = cuerpo as Record<string, unknown>

  if (typeof evento_id !== 'string' || evento_id.length > MAX_ID || !ID_EVENTO.test(evento_id)) return null
  if (alcance !== 'este' && alcance !== 'serie') return null
  if (typeof etag !== 'string' || etag.length > MAX_ETAG || !ETAG.test(etag)) return null
  if (typeof cambios !== 'object' || cambios === null || Array.isArray(cambios)) return null

  const c = cambios as Record<string, unknown>
  const permitidos = ['titulo', 'inicio', 'fin', 'lugar']
  if (Object.keys(c).some((k) => !permitidos.includes(k))) return null
  const limpios: Cambios = {}

  if (c.titulo !== undefined) {
    if (typeof c.titulo !== 'string') return null
    const titulo = c.titulo.trim()
    if (!titulo || titulo.length > MAX_TITULO || tieneControl(titulo)) return null
    limpios.titulo = titulo
  }
  if (c.lugar !== undefined) {
    if (typeof c.lugar !== 'string') return null
    const lugar = c.lugar.trim()
    if (lugar.length > MAX_LUGAR || tieneControl(lugar)) return null
    limpios.lugar = lugar // '' = quitar el lugar
  }
  if (c.inicio !== undefined || c.fin !== undefined) {
    // Se mandan los dos juntos y con el mismo formato: así se comparan como texto, sin cuentas de zonas horarias.
    if (typeof c.inicio !== 'string' || typeof c.fin !== 'string') return null
    const conHora = FECHA_HORA.test(c.inicio) && FECHA_HORA.test(c.fin)
    const deDia = FECHA.test(c.inicio) && FECHA.test(c.fin)
    if (!conHora && !deDia) return null
    if (!fechaValida(c.inicio) || !fechaValida(c.fin)) return null
    if (conHora && (!horaValida(c.inicio) || !horaValida(c.fin))) return null
    if (c.fin <= c.inicio) return null // de todo el día: el fin es exclusivo, así que también debe ser posterior
    if (diasEntre(c.inicio, c.fin) > MAX_DIAS_EVENTO) return null
    limpios.inicio = c.inicio
    limpios.fin = c.fin
  }
  if (Object.keys(limpios).length === 0) return null

  return { eventoId: evento_id, alcance, cambios: limpios, etag }
}

// ¿Se puede usar Google? Devuelve el access token o el estado que lo impide.
async function prepararGoogle(userId: string): Promise<{ token: string } | { estado: Estado }> {
  const { data: conexion, error } = await supabaseAdmin
    .from('google_connections')
    .select('estado, scopes')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    registrarFallo('google-calendar-editar: leer conexión', error.code)
    return { estado: 'error' }
  }
  if (!conexion) return { estado: 'no_conectado' }
  if (conexion.estado === 'reconectar') return { estado: 'reconectar' }
  // Google guarda los scopes concedidos como texto separado por espacios.
  if (!(conexion.scopes ?? '').split(' ').includes(SCOPE_CALENDAR)) return { estado: 'permisos_incompletos' }

  try {
    return { token: await obtenerAccessToken(userId) }
  } catch (e) {
    // obtenerAccessToken ya registró el fallo y, si fue invalid_grant, marcó la conexión como 'reconectar'.
    if (e instanceof ErrorGoogle && e.codigo === 'invalid_grant') return { estado: 'reconectar' }
    if (e instanceof ErrorGoogle && e.codigo === 'sin_conexion') return { estado: 'no_conectado' }
    return { estado: 'error' }
  }
}

interface RespuestaGoogle {
  status: number
  motivo: string // "reason" de Google (p. ej. insufficientPermissions); nunca datos del evento
  evento: EventoGoogle | null
}

async function llamarGoogle(
  token: string,
  metodo: 'GET' | 'PATCH',
  url: string,
  opciones: { cuerpo?: unknown; etag?: string } = {},
): Promise<RespuestaGoogle> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (opciones.cuerpo) headers['Content-Type'] = 'application/json'
  if (opciones.etag) headers['If-Match'] = opciones.etag
  const respuesta = await fetch(url, {
    method: metodo,
    headers,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const datos = await respuesta.json().catch(() => ({}))
  const motivo = typeof datos?.error?.errors?.[0]?.reason === 'string' ? datos.error.errors[0].reason : ''
  return { status: respuesta.status, motivo, evento: respuesta.ok ? (datos as EventoGoogle) : null }
}

const urlEvento = (id: string, params: Record<string, string>) =>
  `${URL_EVENTOS}/${encodeURIComponent(id)}?${new URLSearchParams(params)}`

// El cuerpo del patch: SOLO los campos que cambiaron.
function cuerpoDelPatch(cambios: Cambios): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {}
  if (cambios.titulo !== undefined) cuerpo.summary = cambios.titulo
  if (cambios.lugar !== undefined) cuerpo.location = cambios.lugar
  if (cambios.inicio !== undefined && cambios.fin !== undefined) {
    // Nunca se cambia el tipo (con hora ↔ todo el día: se comprueba antes), así que no hay campos viejos que borrar.
    if (FECHA.test(cambios.inicio)) {
      // Todo el día: el fin ya viene exclusivo.
      cuerpo.start = { date: cambios.inicio }
      cuerpo.end = { date: cambios.fin }
    } else {
      // Hora de pared de Lima sin offset: con timeZone, Google la interpreta en Lima.
      cuerpo.start = { dateTime: `${cambios.inicio}:00`, timeZone: ZONA }
      cuerpo.end = { dateTime: `${cambios.fin}:00`, timeZone: ZONA }
    }
  }
  return cuerpo
}

// Traduce una respuesta fallida de Google a un estado para la app (y lo registra solo con códigos).
function estadoDeFallo(contexto: string, r: RespuestaGoogle): { estado: Estado; motivo?: string } {
  registrarFallo(`google-calendar-editar: ${contexto}`, `${r.status} ${r.motivo}`.trim())
  if (r.status === 412) return { estado: 'conflicto' } // If-Match no coincidió: alguien lo cambió en Google
  if (r.status === 404 || r.status === 410) return { estado: 'conflicto' } // ya no existe: "actualiza"
  if (r.motivo === 'insufficientPermissions') return { estado: 'permisos_incompletos' }
  if (r.status === 403) return { estado: 'no_editable', motivo: 'google' } // Google no deja editarlo (p. ej. no eres el organizador)
  return { estado: 'error' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    // El user_id sale del JWT verificado contra Supabase Auth, nunca del cuerpo.
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const peticion = leerPeticion(await req.json().catch(() => null))
    if (!peticion) return responderJson(req, { estado: 'error', error: 'Petición inválida' }, 400)
    const { eventoId, alcance, cambios, etag } = peticion
    const responder = (estado: Estado, extra: Record<string, unknown> = {}) => responderJson(req, { estado, ...extra })

    // En la serie solo se cambian título y lugar: mover el horario de todas las ocurrencias desde aquí es arriesgado.
    if (alcance === 'serie' && (cambios.inicio !== undefined || cambios.fin !== undefined)) {
      return responder('no_editable', { motivo: 'serie_horario' })
    }

    // Los eventos que creó esta app se editan desde su pendiente (google-calendar-sync los sobrescribiría).
    const { data: tarea, error: errorTarea } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('google_event_id', eventoId)
      .limit(1)
      .maybeSingle()
    if (errorTarea) registrarFallo('google-calendar-editar: leer tasks', errorTarea.code)
    if (tarea) return responder('no_editable', { motivo: 'app' })

    const google = await prepararGoogle(userId)
    if ('estado' in google) return responder(google.estado)
    const { token } = google

    // 1. Se lee la ocurrencia tal como está ahora en Google.
    const actual = await llamarGoogle(token, 'GET', urlEvento(eventoId, { fields: CAMPOS_EVENTO }))
    if (!actual.evento) {
      const f = estadoDeFallo('events.get', actual)
      return responder(f.estado, f.motivo ? { motivo: f.motivo } : {})
    }
    const ocurrencia = actual.evento
    if (ocurrencia.status === 'cancelled') return responder('conflicto') // la borraron en Google

    // 2. ¿Se puede editar? (mismas reglas que el `editable` de google-calendar-events)
    const motivo = motivoNoEditable(ocurrencia)
    if (motivo) return responder('no_editable', { motivo })

    // 3. ¿Es la misma versión que vio el usuario? Si no, no se toca nada.
    if (ocurrencia.etag !== etag) return responder('conflicto')

    // No se convierte un evento con hora en uno de todo el día (ni al revés).
    const esDeDia = !!ocurrencia.start?.date && !ocurrencia.start?.dateTime
    if (cambios.inicio !== undefined && FECHA.test(cambios.inicio) !== esDeDia) {
      return responderJson(req, { estado: 'error', error: 'Petición inválida' }, 400)
    }

    const cuerpo = cuerpoDelPatch(cambios)
    const params = { sendUpdates: 'none', fields: CAMPOS_EVENTO }

    if (alcance === 'este') {
      // 4a. Solo esta ocurrencia (si es de una serie, Google la guarda como excepción).
      const r = await llamarGoogle(token, 'PATCH', urlEvento(eventoId, params), { cuerpo, etag })
      if (!r.evento) {
        const f = estadoDeFallo('events.patch', r)
        return responder(f.estado, f.motivo ? { motivo: f.motivo } : {})
      }
      return responder('ok', { evento: normalizarEvento(r.evento) })
    }

    // 4b. Toda la serie: se edita el evento "padre" (recurringEventId).
    const serieId = ocurrencia.recurringEventId
    if (!serieId) return responder('no_editable', { motivo: 'sin_serie' })

    const padre = await llamarGoogle(token, 'GET', urlEvento(serieId, { fields: CAMPOS_EVENTO }))
    if (!padre.evento) {
      const f = estadoDeFallo('events.get serie', padre)
      return responder(f.estado, f.motivo ? { motivo: f.motivo } : {})
    }
    const motivoSerie = motivoNoEditable(padre.evento)
    if (motivoSerie) return responder('no_editable', { motivo: motivoSerie })

    // If-Match con el etag del padre recién leído: si alguien lo cambió entre la lectura y el patch, 'conflicto'.
    const r = await llamarGoogle(token, 'PATCH', urlEvento(serieId, { sendUpdates: 'none', fields: 'etag' }), {
      cuerpo,
      etag: padre.evento.etag,
    })
    if (!r.evento) {
      const f = estadoDeFallo('events.patch serie', r)
      return responder(f.estado, f.motivo ? { motivo: f.motivo } : {})
    }

    // Se devuelve la ocurrencia que el usuario estaba viendo, ya con los cambios de la serie y su etag nuevo.
    const despues = await llamarGoogle(token, 'GET', urlEvento(eventoId, { fields: CAMPOS_EVENTO }))
    if (!despues.evento) {
      // La serie ya se editó: no es un fallo para el usuario. La app vuelve a pedir los eventos.
      registrarFallo('google-calendar-editar: releer ocurrencia', despues.status)
      return responder('ok', { evento: null })
    }
    return responder('ok', { evento: normalizarEvento(despues.evento) })
  } catch {
    registrarFallo('google-calendar-editar')
    return responderJson(req, { estado: 'error' }, 500)
  }
})
