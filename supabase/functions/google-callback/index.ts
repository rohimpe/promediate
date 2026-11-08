// Paso 2: Google devuelve al usuario aquí (el navegador abre esta URL, sin JWT).
// Por eso la identidad sale del "state" y no de un token: ver la explicación en CLAUDE.md.
// Pase lo que pase, termina redirigiendo a la app; los detalles nunca viajan en la URL.
import { cifrar } from '../_shared/cifrado.ts'
import {
  credencialesGoogle,
  registrarFallo,
  uriRedireccion,
  URL_TOKEN,
  URL_USUARIO,
} from '../_shared/google.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

function volverALaApp(resultado: 'ok' | 'error'): Response {
  const appUrl = Deno.env.get('APP_URL') ?? ''
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}/conexiones?google=${resultado}`, 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response(null, { status: 405 })

  try {
    const url = new URL(req.url)
    const state = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    const errorGoogle = url.searchParams.get('error') // p. ej. access_denied

    if (!state) return volverALaApp('error')

    // El state se usa UNA sola vez: el delete devuelve la fila y la borra a la vez, así
    // que si dos peticiones llegan juntas con el mismo state, solo una la recibe.
    const { data: fila, error: errorState } = await supabaseAdmin
      .from('google_oauth_states')
      .delete()
      .eq('state', state)
      .select('user_id, expira_en')
      .maybeSingle()
    if (errorState) {
      registrarFallo('google-callback: consumir state', errorState.code)
      return volverALaApp('error')
    }
    if (!fila) {
      registrarFallo('google-callback', 'state_invalido')
      return volverALaApp('error')
    }
    if (new Date(fila.expira_en).getTime() < Date.now()) {
      registrarFallo('google-callback', 'state_vencido')
      return volverALaApp('error')
    }
    if (errorGoogle || !code) {
      registrarFallo('google-callback', errorGoogle ?? 'sin_code')
      return volverALaApp('error')
    }

    // Se cambia el code (de un solo uso) por los tokens, hablando directo con Google.
    const { clientId, clientSecret } = credencialesGoogle()
    const respuestaToken = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: uriRedireccion(),
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await respuestaToken.json().catch(() => ({}))
    if (!respuestaToken.ok) {
      registrarFallo('google-callback: intercambiar code', `${respuestaToken.status} ${tokens.error ?? ''}`)
      return volverALaApp('error')
    }
    if (!tokens.refresh_token) {
      registrarFallo('google-callback', 'sin_refresh_token')
      return volverALaApp('error')
    }

    // Correo de la cuenta de Google (el scope "email" lo permite).
    const respuestaUsuario = await fetch(URL_USUARIO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const perfil = await respuestaUsuario.json().catch(() => ({}))
    if (!respuestaUsuario.ok || typeof perfil.email !== 'string') {
      registrarFallo('google-callback: leer correo', respuestaUsuario.status)
      return volverALaApp('error')
    }

    const { error } = await supabaseAdmin.from('google_connections').upsert(
      {
        user_id: fila.user_id,
        refresh_token_cifrado: await cifrar(tokens.refresh_token),
        scopes: tokens.scope ?? null,
        email_google: perfil.email,
        estado: 'activa',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      registrarFallo('google-callback: guardar conexión', error.code)
      return volverALaApp('error')
    }

    return volverALaApp('ok')
  } catch {
    registrarFallo('google-callback')
    return volverALaApp('error')
  }
})
