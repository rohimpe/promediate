// Paso 1 de la conexión: el frontend (con la sesión del usuario) pide la URL de Google.
// Aquí se crea el "state" ligado al usuario y se devuelve la dirección a la que hay que ir.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import {
  credencialesGoogle,
  registrarFallo,
  SCOPES,
  uriRedireccion,
  URL_AUTORIZACION,
} from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

// 32 bytes aleatorios, en hexadecimal (64 caracteres). Imposible de adivinar.
function nuevoState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    // Limpieza: los states vencidos ya no sirven para nada.
    const { error: errorLimpieza } = await supabaseAdmin
      .from('google_oauth_states')
      .delete()
      .lt('expira_en', new Date().toISOString())
    if (errorLimpieza) registrarFallo('google-connect: limpiar states', errorLimpieza.code)

    const state = nuevoState()
    // expira_en usa el valor por defecto de la tabla (ahora + 10 minutos).
    const { error } = await supabaseAdmin.from('google_oauth_states').insert({ state, user_id: userId })
    if (error) {
      registrarFallo('google-connect: guardar state', error.code)
      return responderJson(req, { error: 'No se pudo iniciar la conexión' }, 500)
    }

    const { clientId } = credencialesGoogle()
    const parametros = new URLSearchParams({
      client_id: clientId,
      redirect_uri: uriRedireccion(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline', // para recibir un refresh token
      prompt: 'consent', // para que Google lo entregue siempre, también al reconectar
      include_granted_scopes: 'true',
      state,
    })
    return responderJson(req, { url: `${URL_AUTORIZACION}?${parametros}` })
  } catch {
    registrarFallo('google-connect')
    return responderJson(req, { error: 'No se pudo iniciar la conexión' }, 500)
  }
})
