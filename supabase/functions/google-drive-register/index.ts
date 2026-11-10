// Parte D de la Fase 3: registra en la tabla `archivos` un archivo que el navegador acaba de subir a Drive.
//
// Petición: { drive_file_id, course_id, task_id? }
// Respuesta (200): { estado, archivo? }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'demasiado_grande' | 'tipo_no_permitido' | 'error'
//   archivo: la fila guardada (solo con 'ok')
//
// No se confía en nada de lo que diga el cliente sobre el archivo: el nombre, el tipo, el tamaño y el enlace se le
// piden a Drive con el token del usuario, y se comprueba que el archivo está en la carpeta de ESE curso. Si aun así
// su tipo no está permitido, se borra de Drive y no se registra. El tamaño no se vuelve a comprobar: lo fija la
// sesión de subida que creó google-drive-upload-init (X-Upload-Content-Length, con su MAX_TAMANO_ARCHIVO).
//
// Nunca se registran tokens ni nombres de archivos: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import {
  cursoDelUsuario,
  estadoDeError,
  estadoDeFallo,
  exito,
  ID_DRIVE,
  llamarDrive,
  motivoRechazo,
  prepararDrive,
  UUID,
} from '../_shared/drive.ts'
import { registrarFallo, URL_DRIVE_ARCHIVOS } from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const CONTEXTO = 'google-drive-register'
const CAMPOS = 'id,name,mimeType,size,webViewLink,parents,trashed'

function leerPeticion(cuerpo: unknown) {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { drive_file_id, course_id, task_id } = cuerpo as Record<string, unknown>
  if (typeof drive_file_id !== 'string' || !ID_DRIVE.test(drive_file_id)) return null
  if (typeof course_id !== 'string' || !UUID.test(course_id)) return null
  if (task_id != null && (typeof task_id !== 'string' || !UUID.test(task_id))) return null
  return {
    driveFileId: drive_file_id,
    cursoId: course_id.toLowerCase(),
    tareaId: typeof task_id === 'string' ? task_id.toLowerCase() : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const peticion = leerPeticion(await req.json().catch(() => null))
    if (!peticion) return responderJson(req, { error: 'Petición inválida' }, 400)
    const { driveFileId, cursoId, tareaId } = peticion

    // El curso y la entrega deben ser del usuario del JWT (la política RLS de `archivos` no lo comprueba).
    const curso = await cursoDelUsuario(userId, cursoId, CONTEXTO)
    if (!curso) return responderJson(req, { error: 'Curso no encontrado' }, 404)
    if (!curso.drive_folder_id) return responderJson(req, { estado: 'error' })

    if (tareaId) {
      const { data: tarea, error } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('id', tareaId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) {
        registrarFallo(`${CONTEXTO}: leer tarea`, error.code)
        return responderJson(req, { estado: 'error' }, 500)
      }
      if (!tarea) return responderJson(req, { error: 'Pendiente no encontrado' }, 404)
    }

    const google = await prepararDrive(userId, CONTEXTO)
    if ('estado' in google) return responderJson(req, { estado: google.estado })

    // Los metadatos reales, de Drive. Con drive.file solo se ven los archivos que creó esta app.
    const r = await llamarDrive(
      google.token,
      'GET',
      `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(driveFileId)}?fields=${CAMPOS}`,
    )
    if (!exito(r)) {
      registrarFallo(`${CONTEXTO}: files.get`, `${r.status} ${r.motivo}`.trim())
      return responderJson(req, { estado: estadoDeFallo(r) })
    }
    const archivo = r.datos
    const padres = Array.isArray(archivo.parents) ? archivo.parents : []
    if (archivo.trashed === true || !padres.includes(curso.drive_folder_id)) {
      registrarFallo(`${CONTEXTO}: el archivo no está en la carpeta del curso`)
      return responderJson(req, { estado: 'error' })
    }

    const nombre = typeof archivo.name === 'string' ? archivo.name.slice(0, 255) : ''
    const mime = typeof archivo.mimeType === 'string' ? archivo.mimeType.slice(0, 255) : ''
    // Drive devuelve size como texto; los documentos nativos de Google no tienen tamaño.
    const tamano = typeof archivo.size === 'string' && /^\d+$/.test(archivo.size) ? Number(archivo.size) : null
    const enlace = typeof archivo.webViewLink === 'string' ? archivo.webViewLink.slice(0, 2000) : null

    const rechazo = nombre ? motivoRechazo(nombre, mime) : 'error'
    if (rechazo) {
      // No cumple las reglas aunque pasó la validación inicial: se borra de Drive y no se registra.
      await llamarDrive(google.token, 'DELETE', `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(driveFileId)}`).catch(
        () => {},
      )
      return responderJson(req, { estado: rechazo })
    }

    const { data: fila, error: errorGuardar } = await supabaseAdmin
      .from('archivos')
      .upsert(
        {
          user_id: userId,
          course_id: curso.id,
          task_id: tareaId,
          drive_file_id: driveFileId,
          nombre,
          mime_type: mime || null,
          tamano,
          enlace,
        },
        { onConflict: 'user_id,drive_file_id' },
      )
      .select('id, course_id, task_id, drive_file_id, nombre, mime_type, tamano, enlace, created_at')
      .single()
    if (errorGuardar) {
      registrarFallo(`${CONTEXTO}: guardar fila`, errorGuardar.code)
      return responderJson(req, { estado: 'error' }, 500)
    }

    return responderJson(req, { estado: 'ok', archivo: fila })
  } catch (e) {
    const estado = estadoDeError(e, CONTEXTO)
    return responderJson(req, { estado }, estado === 'error' ? 500 : 200)
  }
})
