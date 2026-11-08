import { createClient } from 'npm:@supabase/supabase-js@2'

// Cliente con la service role key: se salta RLS. SOLO existe aquí, en las Edge Functions.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase solo; no hay que cargarlas.
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Devuelve el id del usuario dueño del JWT de la petición, o null si falta o no es válido.
// getUser(jwt) le pregunta a Supabase Auth, así que también rechaza tokens vencidos o falsos.
export async function usuarioDeLaPeticion(req: Request): Promise<string | null> {
  const cabecera = req.headers.get('Authorization') ?? ''
  const jwt = cabecera.replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !data.user) return null
  return data.user.id
}
