// Parte D de la Fase 3: borra un archivo del Google Drive del usuario y su fila en `archivos`.
//
// Petición: { archivo_id }   (el id de la fila, no el de Drive: el de Drive se lee aquí de la fila del usuario)
// Respuesta (200): { estado }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'error'
//
// Si Google no está disponible, la fila NO se borra (el archivo seguiría en Drive): la app ofrece "Quitar de la
// lista", que solo borra la fila.
//
// Nunca se registran tokens ni nombres de archivos: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import { estadoDeError, estadoDeFallo, exito, llamarDrive, prepararDrive, UUID } from '../_shared/drive.ts'
import { registrarFallo, URL_DRIVE_ARCHIVOS } from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const CONTEXTO = 'google-drive-delete'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const cuerpo = await req.json().catch(() => null)
    const archivoId = cuerpo?.archivo_id
    if (typeof archivoId !== 'string' || !UUID.test(archivoId)) {
      return responderJson(req, { error: 'Petición inválida' }, 400)
    }

    const { data: fila, error } = await supabaseAdmin
      .from('archivos')
      .select('id, drive_file_id')
      .eq('id', archivoId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      registrarFallo(`${CONTEXTO}: leer fila`, error.code)
      return responderJson(req, { estado: 'error' }, 500)
    }
    // Ya no existe (o es de otro usuario): no hay nada que borrar.
    if (!fila) return responderJson(req, { estado: 'ok' })

    const google = await prepararDrive(userId, CONTEXTO)
    if ('estado' in google) return responderJson(req, { estado: google.estado })

    const r = await llamarDrive(google.token, 'DELETE', `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(fila.drive_file_id)}`)
    // 404 / 410: ya no estaba en Drive, así que cuenta como borrado.
    if (!exito(r) && r.status !== 404 && r.status !== 410) {
      registrarFallo(`${CONTEXTO}: files.delete`, `${r.status} ${r.motivo}`.trim())
      return responderJson(req, { estado: estadoDeFallo(r) })
    }

    const { error: errorBorrar } = await supabaseAdmin
      .from('archivos')
      .delete()
      .eq('id', fila.id)
      .eq('user_id', userId)
    if (errorBorrar) {
      registrarFallo(`${CONTEXTO}: borrar fila`, errorBorrar.code)
      return responderJson(req, { estado: 'error' }, 500)
    }

    return responderJson(req, { estado: 'ok' })
  } catch (e) {
    const estado = estadoDeError(e, CONTEXTO)
    return responderJson(req, { estado }, estado === 'error' ? 500 : 200)
  }
})
