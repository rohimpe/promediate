// Parte C de la Fase 3: crea, actualiza o borra en el Google Calendar del usuario el evento de UN pendiente.
//
// Petición: { accion: 'crear' | 'actualizar' | 'borrar', tarea_id }
//   El cliente NO manda datos del evento: la tarea se lee aquí (service role, filtrando por el user_id del JWT)
//   y el evento se arma dentro de la función. Así nadie puede usar esta función para escribir otra cosa en su
//   calendario ni tocar la tarea de otro usuario.
//
// Respuesta (200): { estado, google_event_id, google_sync, google_sync_error }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'error'
//   el resto: cómo quedaron esas columnas de la tarea (para actualizar la pantalla sin recargar)
//
// Id del evento: el uuid de la tarea sin guiones (hex en minúsculas, que Google acepta: base32hex de 5 a 1024
// caracteres). Como siempre es el mismo, reintentar nunca duplica: si al crear Google responde 409 (ya existe),
// se actualiza ese mismo evento.
//
// Nunca se registran tokens ni contenido de eventos: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import {
  ErrorGoogle,
  obtenerAccessToken,
  ORIGEN_APP,
  registrarFallo,
  SCOPE_CALENDAR,
  URL_EVENTOS,
} from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const ZONA = 'America/Lima'
const ACCIONES = ['crear', 'actualizar', 'borrar']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const COLOR_GRIS = '8' // "Grafito" en la paleta de eventos de Google
const MINUTOS_ENTREGA = 30 // una entrega se dibuja como un bloque de 30 min que termina en la hora límite
const AVISOS_ENTREGA = [240, 60, 15] // minutos antes
const AVISOS_ACTIVIDAD = [30]

// Lo que ve el usuario en tasks.google_sync_error: genérico, sin datos de Google.
const MENSAJES: Record<string, string> = {
  no_conectado: 'Google no está conectado.',
  reconectar: 'Google pide volver a conectar tu cuenta.',
  permisos_incompletos: 'Falta el permiso de Google Calendar.',
  sin_fecha: 'El pendiente no tiene fecha.',
  error: 'Google Calendar no respondió. Inténtalo de nuevo.',
}

type Estado = 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'error'

interface Tarea {
  id: string
  tipo: 'tarea' | 'actividad'
  titulo: string
  descripcion: string | null
  fecha_entrega: string | null
  fecha_actividad: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: 'pendiente' | 'completada' | 'justificada'
  google_event_id: string | null
  google_sync: string
  google_sync_error: string | null
  courses: { nombre: string } | null
}

function leerPeticion(cuerpo: unknown): { accion: string; tareaId: string } | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { accion, tarea_id } = cuerpo as Record<string, unknown>
  if (typeof accion !== 'string' || !ACCIONES.includes(accion)) return null
  if (typeof tarea_id !== 'string' || !UUID.test(tarea_id)) return null
  return { accion, tareaId: tarea_id.toLowerCase() }
}

// 'YYYY-MM-DD' + 1 día (en UTC, para que no influya ninguna zona horaria).
function diaSiguiente(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

// El evento de Google a partir de la tarea, o null si la tarea no tiene fecha.
function construirEvento(t: Tarea, idEvento: string): Record<string, unknown> | null {
  const esEntrega = t.tipo === 'tarea'
  let start: Record<string, string>
  let end: Record<string, string>

  if (esEntrega) {
    if (!t.fecha_entrega) return null
    const fin = new Date(t.fecha_entrega)
    if (Number.isNaN(fin.getTime())) return null
    const inicio = new Date(fin.getTime() - MINUTOS_ENTREGA * 60_000)
    start = { dateTime: inicio.toISOString(), timeZone: ZONA }
    end = { dateTime: fin.toISOString(), timeZone: ZONA }
  } else {
    if (!t.fecha_actividad) return null
    if (t.hora_inicio && t.hora_fin) {
      // Hora de pared de Lima sin offset: con timeZone, Google la interpreta en Lima.
      start = { dateTime: `${t.fecha_actividad}T${t.hora_inicio.slice(0, 5)}:00`, timeZone: ZONA }
      end = { dateTime: `${t.fecha_actividad}T${t.hora_fin.slice(0, 5)}:00`, timeZone: ZONA }
    } else {
      // Actividad sin hora: evento de todo el día (en Google el fin es exclusivo).
      start = { date: t.fecha_actividad }
      end = { date: diaSiguiente(t.fecha_actividad) }
    }
  }

  // Google Calendar no tiene "completado": solo se marca a la vista (prefijo y color gris).
  const prefijo = t.estado === 'completada' ? '✓ ' : t.estado === 'justificada' ? '~ ' : ''

  const lineas: string[] = []
  if (esEntrega && t.courses?.nombre) lineas.push(`Curso: ${t.courses.nombre}`)
  if (t.descripcion?.trim()) lineas.push(t.descripcion.trim())
  lineas.push('Creado desde Tablero de Vida')

  return {
    id: idEvento,
    summary: `${prefijo}${esEntrega ? '📚 ' : ''}${t.titulo}`,
    description: lineas.join('\n\n'),
    start,
    end,
    // Se reemplaza el evento entero (PUT): sin colorId vuelve al color del calendario. 'confirmed' además lo
    // recupera si el usuario lo había borrado en Google (el de la app manda).
    status: 'confirmed',
    ...(prefijo ? { colorId: COLOR_GRIS } : {}),
    reminders: {
      useDefault: false,
      overrides: (esEntrega ? AVISOS_ENTREGA : AVISOS_ACTIVIDAD).map((minutes) => ({ method: 'popup', minutes })),
    },
    extendedProperties: { private: { origen: ORIGEN_APP, tarea_id: t.id } },
  }
}

interface RespuestaGoogle {
  status: number
  motivo: string // "reason" de Google (p. ej. insufficientPermissions); nunca datos del evento
}

async function llamarGoogle(token: string, metodo: string, url: string, cuerpo?: unknown): Promise<RespuestaGoogle> {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const datos = await respuesta.json().catch(() => ({}))
  const motivo = typeof datos?.error?.errors?.[0]?.reason === 'string' ? datos.error.errors[0].reason : ''
  return { status: respuesta.status, motivo }
}

const exito = (r: RespuestaGoogle) => r.status >= 200 && r.status < 300

// Crea o actualiza el evento. `existe`: la tarea ya tiene google_event_id, así que se intenta actualizar primero.
async function guardarEnGoogle(token: string, idEvento: string, evento: unknown, existe: boolean) {
  const urlEvento = `${URL_EVENTOS}/${idEvento}`
  // fields=id: que Google no devuelva el evento entero (no lo necesitamos).
  const crear = () => llamarGoogle(token, 'POST', `${URL_EVENTOS}?fields=id`, evento)
  const actualizar = () => llamarGoogle(token, 'PUT', `${urlEvento}?fields=id`, evento)

  let r = existe ? await actualizar() : await crear()
  if (!existe && r.status === 409) r = await actualizar() // ya existía (un reintento): se actualiza, nunca se duplica
  else if (existe && (r.status === 404 || r.status === 410)) r = await crear() // ya no está en Google: se vuelve a crear
  return r
}

// ¿Se puede usar Google? Devuelve el access token o el estado que impide usarlo.
async function prepararGoogle(userId: string): Promise<{ token: string } | { estado: Estado }> {
  const { data: conexion, error } = await supabaseAdmin
    .from('google_connections')
    .select('estado, scopes')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    registrarFallo('google-calendar-sync: leer conexión', error.code)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    // El user_id sale del JWT verificado contra Supabase Auth, nunca del cuerpo.
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const peticion = leerPeticion(await req.json().catch(() => null))
    if (!peticion) return responderJson(req, { error: 'Petición inválida' }, 400)
    const { accion, tareaId } = peticion

    const { data: tarea, error: errorTarea } = await supabaseAdmin
      .from('tasks')
      .select(
        'id, tipo, titulo, descripcion, fecha_entrega, fecha_actividad, hora_inicio, hora_fin, estado, google_event_id, google_sync, google_sync_error, courses(nombre)',
      )
      .eq('id', tareaId)
      .eq('user_id', userId)
      .maybeSingle<Tarea>()
    if (errorTarea) {
      registrarFallo('google-calendar-sync: leer tarea', errorTarea.code)
      return responderJson(req, { estado: 'error' }, 500)
    }

    const sinEvento = { google_event_id: null, google_sync: 'ninguno', google_sync_error: null }
    if (!tarea) {
      // Borrar algo que ya no existe no es un error; crear o actualizar sí.
      if (accion === 'borrar') return responderJson(req, { estado: 'ok', ...sinEvento })
      return responderJson(req, { estado: 'error' }, 404)
    }

    const idEvento = tarea.id.replaceAll('-', '')
    // 'pendiente' o 'error': puede que Google sí lo haya creado aunque la app no recibió la respuesta.
    const tocaGoogle = !!tarea.google_event_id || tarea.google_sync !== 'ninguno'
    const actual = {
      google_event_id: tarea.google_event_id,
      google_sync: tarea.google_sync,
      google_sync_error: tarea.google_sync_error,
    }

    // Un pendiente que nunca se mandó a Google no se crea al editarlo ni hay nada que borrar.
    if (accion !== 'crear' && !tocaGoogle) return responderJson(req, { estado: 'ok', ...actual })

    // Guarda en la tarea cómo quedó la sincronización (solo columnas de Google; filtra también por user_id).
    async function guardarEstado(campos: Record<string, unknown>) {
      const { error } = await supabaseAdmin.from('tasks').update(campos).eq('id', tareaId).eq('user_id', userId)
      if (error) registrarFallo('google-calendar-sync: guardar estado', error.code)
    }

    // Si falla al crear o actualizar, la tarea queda en 'error' para que la app ofrezca "Reintentar".
    // Al borrar no se toca: la app borra la fila de todos modos.
    async function fallo(estado: Estado, clave: string = estado) {
      if (accion === 'borrar') return responderJson(req, { estado, ...actual })
      const campos = { google_sync: 'error', google_sync_error: MENSAJES[clave] }
      await guardarEstado(campos)
      return responderJson(req, { estado, ...actual, ...campos })
    }

    const google = await prepararGoogle(userId)
    if ('estado' in google) return fallo(google.estado)

    if (accion === 'borrar') {
      const r = await llamarGoogle(google.token, 'DELETE', `${URL_EVENTOS}/${idEvento}`)
      // 404 / 410: ya no estaba en Google, así que cuenta como borrado.
      if (!exito(r) && r.status !== 404 && r.status !== 410) {
        registrarFallo('google-calendar-sync: events.delete', `${r.status} ${r.motivo}`.trim())
        return fallo(r.motivo === 'insufficientPermissions' ? 'permisos_incompletos' : 'error')
      }
      await guardarEstado(sinEvento)
      return responderJson(req, { estado: 'ok', ...sinEvento })
    }

    const evento = construirEvento(tarea, idEvento)
    if (!evento) return fallo('error', 'sin_fecha')

    const r = await guardarEnGoogle(google.token, idEvento, evento, !!tarea.google_event_id)
    if (!exito(r)) {
      registrarFallo(`google-calendar-sync: ${accion}`, `${r.status} ${r.motivo}`.trim())
      return fallo(r.motivo === 'insufficientPermissions' ? 'permisos_incompletos' : 'error')
    }

    const listo = { google_event_id: idEvento, google_sync: 'ok', google_sync_error: null }
    await guardarEstado(listo)
    return responderJson(req, { estado: 'ok', ...listo })
  } catch {
    registrarFallo('google-calendar-sync')
    return responderJson(req, { estado: 'error' }, 500)
  }
})
