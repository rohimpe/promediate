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
