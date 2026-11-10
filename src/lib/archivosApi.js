import { validarArchivoLocal } from './archivos'
import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Archivos en Google Drive (Parte D). Las lecturas van directo a la tabla `archivos` (RLS: solo las filas del
// usuario). Lo que toca Drive pasa por las Edge Functions: el access token de Google nunca llega al navegador.

const COLUMNAS = 'id, course_id, carpeta_id, task_id, drive_file_id, nombre, mime_type, tamano, enlace, created_at'
const COLUMNAS_CARPETA = 'id, course_id, parent_id, drive_folder_id, nombre, created_at'

// Cursos con su carpeta de Drive, cuántos archivos tiene cada uno (incluidos los de sus carpetas) y cuántas
// carpetas propias (archivos(count) y carpetas(count), en la misma consulta).
export async function listarCursosConArchivos() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color, drive_folder_id, archivos(count), carpetas(count)')
    .order('created_at')
  if (error) throw registrarError(error)
  return data
}

export async function obtenerCursoConCarpeta(id) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color, drive_folder_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw registrarError(error)
  return data // null si no existe o no es del usuario
}

// Archivos de un curso ({ cursoId }), de una entrega ({ tareaId }) o los que quedaron sin curso ({ sinCurso: true }),
// los más nuevos primero.
export async function listarArchivos({ cursoId, tareaId, sinCurso } = {}) {
  let consulta = supabase.from('archivos').select(COLUMNAS).order('created_at', { ascending: false })
  if (cursoId) consulta = consulta.eq('course_id', cursoId)
  if (tareaId) consulta = consulta.eq('task_id', tareaId)
  if (sinCurso) consulta = consulta.is('course_id', null)
  const { data, error } = await consulta
  if (error) throw registrarError(error)
  return data
}

// Todas las carpetas propias de un curso (a cualquier profundidad). El árbol se arma en el navegador.
export async function listarCarpetas(cursoId) {
  const { data, error } = await supabase
    .from('carpetas')
    .select(COLUMNAS_CARPETA)
    .eq('course_id', cursoId)
    .order('nombre')
  if (error) throw registrarError(error)
  return data
}

// Solo borra la fila (para archivos que el usuario ya borró en Drive). No toca Drive.
export async function quitarDeLista(id) {
  const { error } = await supabase.from('archivos').delete().eq('id', id)
  if (error) throw registrarError(error)
}

// Llama a una función de Drive. NUNCA lanza error: si la función no responde, devuelve { estado: 'error' }.
async function invocar(funcion, body) {
  const { data, error } = await supabase.functions.invoke(funcion, { body })
  if (error || !data?.estado) {
    if (error) registrarError(error)
    return { estado: 'error' }
  }
  return data
}

// Borra el archivo de Drive y su fila. Devuelve { estado } ('ok', 'no_conectado', 'reconectar', …).
export const borrarArchivo = (archivoId) => invocar('google-drive-delete', { archivo_id: archivoId })

// Carpetas propias (google-drive-folder). Devuelven { estado, carpeta? } (claves de MENSAJES_CARPETA).
//   parentId null = directamente en la carpeta del curso
export const crearCarpeta = ({ cursoId, parentId = null, nombre }) =>
  invocar('google-drive-folder', { accion: 'crear', course_id: cursoId, parent_id: parentId, nombre })
export const renombrarCarpeta = (carpetaId, nombre) =>
  invocar('google-drive-folder', { accion: 'renombrar', carpeta_id: carpetaId, nombre })
// Manda la carpeta (con todo su contenido) a la papelera de Drive y borra sus filas y las de sus subcarpetas y
// archivos. Devuelve { estado, carpetas?, archivos? } con cuántas filas se quitaron.
export const borrarCarpeta = (carpetaId) => invocar('google-drive-folder', { accion: 'borrar', carpeta_id: carpetaId })

// PUT del archivo directo a la URL de sesión de Google, con progreso (0 a 1). Se usa XMLHttpRequest porque fetch no
// informa el progreso de subida. Devuelve { estado: 'ok', id } con el id del archivo en Drive, o un estado de error.
function enviarAGoogle(urlSesion, archivo, onProgreso) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', urlSesion)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgreso(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        let id = null
        try {
          id = JSON.parse(xhr.responseText)?.id ?? null
        } catch {
          // sin cuerpo legible: se trata como error abajo
        }
        if (id) return resolve({ estado: 'ok', id })
      }
      console.error('Google Drive rechazó la subida:', { status: xhr.status })
      resolve({ estado: 'error' })
    }
    // Sin respuesta: o se cortó internet, o el navegador bloqueó la respuesta por CORS (eso se ve en la consola, F12).
    xhr.onerror = () => {
      console.error('La subida a Google Drive no recibió respuesta (red caída o bloqueo CORS).')
      resolve({ estado: navigator.onLine ? 'sin_respuesta' : 'sin_conexion' })
    }
    xhr.send(archivo)
  })
}

// Sube un archivo del navegador (File) a la carpeta del curso, o a una carpeta propia si hay carpetaId, y lo registra
// (vinculado a la entrega si hay tareaId).
//   1) google-drive-upload-init valida y devuelve la URL de sesión;
//   2) el navegador sube los bytes directo a Google;
//   3) google-drive-register lee de Drive los datos reales y guarda la fila.
// onProgreso(fraccion) recibe de 0 a 1 mientras se envían los bytes. NUNCA lanza error:
// devuelve { estado: 'ok', archivo } o { estado } con el motivo (claves de MENSAJES_ARCHIVO).
export async function subirArchivo(archivo, { cursoId, carpetaId = null, tareaId = null }, onProgreso = () => {}) {
  const rechazo = validarArchivoLocal(archivo)
  if (rechazo) return { estado: rechazo }
  if (!navigator.onLine) return { estado: 'sin_conexion' }

  const inicio = await invocar('google-drive-upload-init', {
    course_id: cursoId,
    carpeta_id: carpetaId,
    nombre: archivo.name,
    mime_type: archivo.type,
    tamano: archivo.size,
  })
  if (inicio.estado !== 'ok' || !inicio.upload_url) return { estado: inicio.estado === 'ok' ? 'error' : inicio.estado }

  const envio = await enviarAGoogle(inicio.upload_url, archivo, onProgreso)
  if (envio.estado !== 'ok') return envio
  onProgreso(1)

  const registro = await invocar('google-drive-register', {
    drive_file_id: envio.id,
    course_id: cursoId,
    carpeta_id: carpetaId,
    task_id: tareaId,
  })
  if (registro.estado !== 'ok' || !registro.archivo) return { estado: registro.estado === 'ok' ? 'error' : registro.estado }
  return registro
}
