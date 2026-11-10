import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Estado de la conexión con Google del usuario. Nunca incluye tokens: viene de la función
// SQL mi_conexion_google(), porque las tablas de conexiones no se pueden leer desde el frontend.
// Devuelve { conectado, email_google, estado } ('estado' es 'activa' o 'reconectar').
export async function obtenerConexionGoogle() {
  const { data, error } = await supabase.rpc('mi_conexion_google')
  if (error) throw registrarError(error)
  return data?.[0] ?? { conectado: false, email_google: null, estado: null }
}

// Pide a la Edge Function la dirección de Google a la que hay que enviar al usuario.
export async function pedirUrlConexionGoogle() {
  const { data, error } = await supabase.functions.invoke('google-connect')
  if (error) throw registrarError(error)
  if (!data?.url) throw new Error('La respuesta de google-connect no trae la URL')
  return data.url
}

export async function desconectarGoogle() {
  const { error } = await supabase.functions.invoke('google-disconnect')
  if (error) throw registrarError(error)
}

// Eventos de Google Calendar entre dos instantes ISO (máximo 100 días de rango).
// Devuelve { estado, eventos, truncado }; 'estado' es 'ok', 'no_conectado', 'reconectar' o
// 'permisos_incompletos'. Los eventos vienen crudos de la función: los convierte googleAEventos.
export async function obtenerEventosGoogle(desde, hasta) {
  const { data, error } = await supabase.functions.invoke('google-calendar-events', { body: { desde, hasta } })
  if (error) throw registrarError(error)
  return { estado: data.estado, eventos: data.eventos ?? [], truncado: !!data.truncado }
}

// Crea, actualiza o borra en Google Calendar el evento de un pendiente (accion: 'crear' | 'actualizar' | 'borrar').
// Solo se manda el id: la función lee la tarea y arma el evento. NUNCA lanza error:
// devuelve { estado, google_event_id, google_sync, google_sync_error } (cómo quedó la tarea), o
// { estado: 'error', google_sync: null } si la función no respondió (no se sabe cómo quedó).
export async function sincronizarConGoogle(accion, tareaId) {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { accion, tarea_id: tareaId },
  })
  if (error || !data?.estado) {
    if (error) registrarError(error)
    return { estado: 'error', google_sync: null }
  }
  return data
}

// Edita un evento que ya existía en Google Calendar (Parte C2).
//   eventoId: googleId de la ocurrencia · alcance: 'este' | 'serie' · etag: el que trae el evento
//   cambios:  solo lo que cambió: { titulo?, lugar?, inicio?, fin? } (fechas en hora de Lima: 'YYYY-MM-DDTHH:mm', o
//             'YYYY-MM-DD' con fin exclusivo si es de todo el día)
// NUNCA lanza error: devuelve { estado, evento?, motivo? } con estado 'ok', 'no_conectado', 'reconectar',
// 'permisos_incompletos', 'no_editable', 'conflicto' o 'error' (también si la función no respondió).
// `evento` viene crudo de la función (lo convierte googleAEventos) y puede ser null tras editar una serie.
export async function editarEventoGoogle({ eventoId, alcance, cambios, etag }) {
  const { data, error } = await supabase.functions.invoke('google-calendar-editar', {
    body: { evento_id: eventoId, alcance, cambios, etag },
  })
  if (error || !data?.estado) {
    if (error) registrarError(error)
    return { estado: 'error' }
  }
  return data
}

// Enlace directo a un evento del calendario principal del usuario. Es el mismo formato que usa Google
// (htmlLink): base64 de "<id del evento> <id del calendario>", y el id del calendario principal es el correo.
export function enlaceEventoGoogle(idEvento, emailGoogle) {
  if (!idEvento || !emailGoogle) return null
  try {
    const eid = btoa(`${idEvento} ${emailGoogle}`).replace(/=+$/, '')
    return `https://www.google.com/calendar/event?eid=${eid}`
  } catch {
    return null // btoa no acepta caracteres fuera de Latin-1 (un correo raro): mejor sin enlace
  }
}
