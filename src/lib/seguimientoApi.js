import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Eventos de Google Calendar marcados u ocultos. Todas las consultas pasan por RLS:
// Supabase solo devuelve / modifica las filas con user_id = auth.uid() (la base lo rellena sola).

// --- google_seguimiento: solo los eventos marcados (completada / justificada) ---

export async function listarSeguimiento() {
  const { data, error } = await supabase.from('google_seguimiento').select('*')
  if (error) throw registrarError(error)
  return data
}

// Crea o actualiza la fila de una ocurrencia. `onConflict` apunta a la restricción única
// (user_id, google_event_id): si ya hay fila se actualiza, nunca se duplica.
// `campos` = resumen del evento (resumenDeEvento) + estado, justificacion y completed_at.
export async function guardarSeguimiento(campos) {
  const { data, error } = await supabase
    .from('google_seguimiento')
    .upsert(campos, { onConflict: 'user_id,google_event_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Deshacer: borra la fila y el evento vuelve a ser un pendiente virtual.
export async function borrarSeguimiento(googleId) {
  const { error } = await supabase.from('google_seguimiento').delete().eq('google_event_id', googleId)
  if (error) throw registrarError(error)
}

// Borra las marcas de todas las ocurrencias de una serie (al quitar la serie de los pendientes).
export async function borrarSeguimientoDeSerie(serieId) {
  const { error } = await supabase.from('google_seguimiento').delete().eq('serie_id', serieId)
  if (error) throw registrarError(error)
}

// --- google_ocultos: lo que el usuario quitó de sus pendientes ---

export async function listarOcultos() {
  const { data, error } = await supabase.from('google_ocultos').select('*').order('created_at', { ascending: false })
  if (error) throw registrarError(error)
  return data
}

// Oculta un evento suelto. Con upsert, ocultarlo dos veces no da error ni duplica.
export async function ocultarEvento(googleId, titulo) {
  const { data, error } = await supabase
    .from('google_ocultos')
    .upsert({ google_event_id: googleId, titulo }, { onConflict: 'user_id,google_event_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Oculta una serie entera.
export async function ocultarSerie(serieId, titulo) {
  const { data, error } = await supabase
    .from('google_ocultos')
    .upsert({ serie_id: serieId, titulo }, { onConflict: 'user_id,serie_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// "Volver a incluir": borra la fila de google_ocultos.
export async function borrarOculto(id) {
  const { error } = await supabase.from('google_ocultos').delete().eq('id', id)
  if (error) throw registrarError(error)
}

// --- google_colores: colores propios de eventos, series y títulos (Google no devuelve los personalizados) ---

export async function listarColores() {
  const { data, error } = await supabase.from('google_colores').select('*')
  if (error) throw registrarError(error)
  return data
}

// Pinta una ocurrencia. Con upsert, volver a elegir color actualiza la fila en vez de duplicarla.
export async function guardarColorEvento(googleId, colorId) {
  const { data, error } = await supabase
    .from('google_colores')
    .upsert({ google_event_id: googleId, color_id: colorId }, { onConflict: 'user_id,google_event_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Pinta una serie entera.
export async function guardarColorSerie(serieId, colorId) {
  const { data, error } = await supabase
    .from('google_colores')
    .upsert({ serie_id: serieId, color_id: colorId }, { onConflict: 'user_id,serie_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Pinta todos los eventos con el mismo título. `tituloNorm` viene de normalizarTitulo (seguimiento.js).
export async function guardarColorTitulo(tituloNorm, colorId) {
  const { data, error } = await supabase
    .from('google_colores')
    .upsert({ titulo_norm: tituloNorm, color_id: colorId }, { onConflict: 'user_id,titulo_norm' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Restablecer: borra la fila y el evento vuelve a su color de Google.
export async function borrarColorEvento(googleId) {
  const { error } = await supabase.from('google_colores').delete().eq('google_event_id', googleId)
  if (error) throw registrarError(error)
}

export async function borrarColorSerie(serieId) {
  const { error } = await supabase.from('google_colores').delete().eq('serie_id', serieId)
  if (error) throw registrarError(error)
}

export async function borrarColorTitulo(tituloNorm) {
  const { error } = await supabase.from('google_colores').delete().eq('titulo_norm', tituloNorm)
  if (error) throw registrarError(error)
}
