import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Seguimiento de eventos de Google Calendar. Todas las consultas pasan por RLS:
// Supabase solo devuelve / modifica las filas con user_id = auth.uid() (la base lo rellena sola).

export async function listarSeguimiento() {
  const { data, error } = await supabase.from('google_seguimiento').select('*')
  if (error) throw registrarError(error)
  return data
}

export async function listarSeriesSeguidas() {
  const { data, error } = await supabase.from('google_series_seguidas').select('*')
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

export async function borrarSeguimiento(googleId) {
  const { error } = await supabase.from('google_seguimiento').delete().eq('google_event_id', googleId)
  if (error) throw registrarError(error)
}

export async function crearSerieSeguida(serieId, titulo) {
  const { data, error } = await supabase
    .from('google_series_seguidas')
    .upsert({ serie_id: serieId, titulo }, { onConflict: 'user_id,serie_id' })
    .select()
    .single()
  if (error) throw registrarError(error)
  return data
}

// Solo borra la serie: las filas ya marcadas (google_seguimiento) se conservan.
export async function borrarSerieSeguida(serieId) {
  const { error } = await supabase.from('google_series_seguidas').delete().eq('serie_id', serieId)
  if (error) throw registrarError(error)
}
