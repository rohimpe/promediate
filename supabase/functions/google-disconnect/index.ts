// Desconectar Google: revoca el permiso en Google y borra la conexión guardada.
// La fila se borra SIEMPRE, aunque la revocación falle (p. ej. si el token ya estaba revocado).
import { descifrar } from '../_shared/cifrado.ts'
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import { registrarFallo, URL_REVOCAR } from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const { data: conexion, error: errorLectura } = await supabaseAdmin
      .from('google_connections')
      .select('refresh_token_cifrado')
      .eq('user_id', userId)
      .maybeSingle()
    if (errorLectura) registrarFallo('google-disconnect: leer conexión', errorLectura.code)

    if (conexion) {
      try {
        const token = await descifrar(conexion.refresh_token_cifrado)
        const respuesta = await fetch(URL_REVOCAR, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        })
        if (!respuesta.ok) registrarFallo('google-disconnect: revocar', respuesta.status)
      } catch {
        registrarFallo('google-disconnect: revocar')
      }
    }

    const { error } = await supabaseAdmin.from('google_connections').delete().eq('user_id', userId)
    if (error) {
      registrarFallo('google-disconnect: borrar conexión', error.code)
      return responderJson(req, { error: 'No se pudo desconectar' }, 500)
    }
    return responderJson(req, { ok: true })
  } catch {
    registrarFallo('google-disconnect')
    return responderJson(req, { error: 'No se pudo desconectar' }, 500)
  }
})
