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
  if (error) throw error
  return data?.ultimo_resumen ?? null
}

// "upsert" = actualiza el perfil y, si por algún motivo no existiera, lo crea.
export async function guardarUltimoResumen(userId, fecha) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ultimo_resumen: fecha })
  if (error) throw error
}

// Nombre del perfil, o null si no tiene (o no hay fila de perfil).
export async function obtenerNombrePerfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.nombre?.trim() || null
}
