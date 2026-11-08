import { descifrar } from './cifrado.ts'
import { supabaseAdmin } from './supabaseAdmin.ts'

export const URL_AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth'
export const URL_TOKEN = 'https://oauth2.googleapis.com/token'
export const URL_REVOCAR = 'https://oauth2.googleapis.com/revoke'
export const URL_USUARIO = 'https://openidconnect.googleapis.com/v1/userinfo'

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
]

// Debe ser idéntico al "URI de redireccionamiento" del cliente OAuth en Google Cloud.
// SUPABASE_URL (https://<proyecto>.supabase.co) la inyecta Supabase.
export function uriRedireccion(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-callback`
}

// Variables que Google exige para cualquier llamada de OAuth.
export function credencialesGoogle(): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET')
  return { clientId, clientSecret }
}

// Solo mensajes genéricos y códigos: nunca tokens, códigos de autorización ni secrets.
export function registrarFallo(contexto: string, codigo?: string | number) {
  console.error(`[${contexto}] falló${codigo !== undefined ? ` (${codigo})` : ''}`)
}

export class ErrorGoogle extends Error {
  constructor(public codigo: string) {
    super(codigo)
  }
}

// Cambia el refresh token guardado por un access token nuevo (dura ~1 hora).
// Se usará en las partes B y C (Calendar y Drive). Si Google responde invalid_grant (el
// usuario revocó el permiso o el token venció), marca la conexión como 'reconectar'.
export async function obtenerAccessToken(userId: string): Promise<string> {
  const { data: conexion, error } = await supabaseAdmin
    .from('google_connections')
    .select('refresh_token_cifrado, estado')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    registrarFallo('obtenerAccessToken: leer conexión', error.code)
    throw new ErrorGoogle('error_base_de_datos')
  }
  if (!conexion) throw new ErrorGoogle('sin_conexion')
  if (conexion.estado === 'reconectar') throw new ErrorGoogle('invalid_grant')

  const refreshToken = await descifrar(conexion.refresh_token_cifrado)
  const { clientId, clientSecret } = credencialesGoogle()
  const respuesta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const cuerpo = await respuesta.json().catch(() => ({}))

  if (!respuesta.ok) {
    const codigo = typeof cuerpo.error === 'string' ? cuerpo.error : 'error_desconocido'
    registrarFallo('obtenerAccessToken: refrescar', `${respuesta.status} ${codigo}`)
    if (codigo === 'invalid_grant') {
      await supabaseAdmin
        .from('google_connections')
        .update({ estado: 'reconectar', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }
    throw new ErrorGoogle(codigo)
  }
  return cuerpo.access_token as string
}
