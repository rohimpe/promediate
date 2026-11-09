import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Fecha ('YYYY-MM-DD') en que el usuario vio por última vez el resumen del día,
// o null si nunca lo ha visto. Se guarda en la base de datos (no en el navegador)
// para que funcione igual en todos sus dispositivos.
export async function obtenerUltimoResumen(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('ultimo_resumen')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw registrarError(error)
  return data?.ultimo_resumen ?? null
}

// "upsert" = actualiza el perfil y, si por algún motivo no existiera, lo crea.
export async function guardarUltimoResumen(userId, fecha) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ultimo_resumen: fecha })
  if (error) throw registrarError(error)
}

// Nombre del perfil, o null si no tiene (o no hay fila de perfil).
export async function obtenerNombrePerfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw registrarError(error)
  return data?.nombre?.trim() || null
}

// ¿Los eventos de Google de todo el día entran a los pendientes? (false si no hay perfil o falla la columna).
export async function obtenerIncluirTodoElDia(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('google_incluir_todo_el_dia')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw registrarError(error)
  return data?.google_incluir_todo_el_dia ?? false
}

// ¿Los pendientes nuevos se crean también en Google Calendar? (valor por defecto del interruptor del formulario).
export async function obtenerSincronizarGoogle(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('google_sincronizar')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw registrarError(error)
  return data?.google_sincronizar ?? true
}

export async function guardarSincronizarGoogle(userId, valor) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, google_sincronizar: valor })
  if (error) throw registrarError(error)
}

export async function guardarIncluirTodoElDia(userId, valor) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, google_incluir_todo_el_dia: valor })
  if (error) throw registrarError(error)
}
