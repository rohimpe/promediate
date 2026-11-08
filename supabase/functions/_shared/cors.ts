// CORS: el navegador solo deja que una página llame a otro dominio si ese dominio lo permite.
// Aquí solo permitimos la app publicada (APP_URL) y el servidor local de desarrollo.

function origenesPermitidos(): string[] {
  const appUrl = Deno.env.get('APP_URL')
  return [appUrl, 'http://localhost:5173'].filter((o): o is string => !!o)
}

export function corsHeaders(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin') ?? ''
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // La respuesta cambia según el origen: que ninguna caché la reutilice para otro.
    Vary: 'Origin',
  }
  if (origenesPermitidos().includes(origen)) base['Access-Control-Allow-Origin'] = origen
  return base
}

// Respuesta a la petición "preflight" que el navegador manda antes del POST real.
export function responderPreflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export function responderJson(req: Request, cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
