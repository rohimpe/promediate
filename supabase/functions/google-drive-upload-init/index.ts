// Parte D de la Fase 3: prepara la subida de UN archivo a la carpeta de un curso en el Google Drive del usuario.
//
// Petición: { course_id, nombre, mime_type, tamano }
// Respuesta (200): { estado, upload_url? }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'demasiado_grande' | 'tipo_no_permitido' | 'error'
//   upload_url: la URL de la sesión de subida reanudable (solo con 'ok')
//
// Cómo funciona: la función asegura las carpetas, inicia en Drive una subida reanudable (uploadType=resumable) con
// el nombre, el tipo y el tamaño ya fijados, y devuelve la URL de esa sesión. El navegador sube los bytes con un PUT
// directo a esa URL: el archivo no pasa por Supabase y el access token nunca sale de aquí. La URL de sesión solo
// sirve para terminar ESA subida, en esa carpeta.
//
// La sesión se inicia con la cabecera Origin de la app: Google solo acepta el PUT del navegador (CORS) desde el
// origen con el que se inició la sesión.
//
// Nunca se registran tokens, la URL de sesión ni nombres de archivos: solo mensajes genéricos y códigos.
import { corsHeaders, origenDeLaApp, responderJson, responderPreflight } from '../_shared/cors.ts'
import {
  asegurarCarpetaCurso,
  cursoDelUsuario,
  estadoDeError,
  estadoDeFallo,
  exito,
  llamarDrive,
  motivoRechazo,
  nombreValido,
  prepararDrive,
  UUID,
} from '../_shared/drive.ts'
import { registrarFallo, URL_DRIVE_SUBIDA } from '../_shared/google.ts'
import { usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const CONTEXTO = 'google-drive-upload-init'
const MIME_GENERICO = 'application/octet-stream'

// Tope de tamaño de un archivo: el ÚNICO del backend. La sesión de subida fija la cantidad de bytes
// (X-Upload-Content-Length), así que en Drive nunca puede quedar un archivo más grande que lo aprobado aquí.
// El frontend tiene su copia en src/lib/archivos.js (solo para avisar antes de subir): si cambias uno, cambia el otro.
const MAX_TAMANO_ARCHIVO = 100 * 1024 * 1024 // 100 MB

function leerPeticion(cuerpo: unknown) {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const { course_id, nombre, mime_type, tamano } = cuerpo as Record<string, unknown>
  if (typeof course_id !== 'string' || !UUID.test(course_id)) return null
  if (!nombreValido(nombre)) return null
  if (typeof tamano !== 'number' || !Number.isSafeInteger(tamano) || tamano < 0) return null
  // El navegador a veces no sabe el tipo (manda ''): entonces se sube como binario genérico.
  let mime = typeof mime_type === 'string' ? mime_type.trim().slice(0, 255) : ''
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) mime = MIME_GENERICO
  return { cursoId: course_id.toLowerCase(), nombre: nombre.trim(), mime, tamano }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    // El user_id sale del JWT verificado contra Supabase Auth, nunca del cuerpo.
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const peticion = leerPeticion(await req.json().catch(() => null))
    if (!peticion) return responderJson(req, { error: 'Petición inválida' }, 400)
    const { cursoId, nombre, mime, tamano } = peticion

    // Se valida antes de tocar Google: así un archivo rechazado no crea carpetas.
    const rechazo = motivoRechazo(nombre, mime) ?? (tamano > MAX_TAMANO_ARCHIVO ? 'demasiado_grande' : null)
    if (rechazo) return responderJson(req, { estado: rechazo })

    const curso = await cursoDelUsuario(userId, cursoId, CONTEXTO)
    if (!curso) return responderJson(req, { error: 'Curso no encontrado' }, 404)

    const google = await prepararDrive(userId, CONTEXTO)
    if ('estado' in google) return responderJson(req, { estado: google.estado })

    const carpeta = await asegurarCarpetaCurso(google.token, userId, curso)

    const origen = origenDeLaApp(req)
    const r = await llamarDrive(google.token, 'POST', `${URL_DRIVE_SUBIDA}?uploadType=resumable&fields=id`, {
      cuerpo: { name: nombre, mimeType: mime, parents: [carpeta] },
      cabeceras: {
        'X-Upload-Content-Type': mime,
        // Google rechaza la subida si el navegador manda otra cantidad de bytes.
        'X-Upload-Content-Length': String(tamano),
        ...(origen ? { Origin: origen } : {}),
      },
    })
    const uploadUrl = r.cabeceras.get('Location')
    if (!exito(r) || !uploadUrl) {
      registrarFallo(`${CONTEXTO}: iniciar subida`, `${r.status} ${r.motivo}`.trim())
      return responderJson(req, { estado: estadoDeFallo(r) })
    }

    return responderJson(req, { estado: 'ok', upload_url: uploadUrl })
  } catch (e) {
    const estado = estadoDeError(e, CONTEXTO)
    return responderJson(req, { estado }, estado === 'error' ? 500 : 200)
  }
})
