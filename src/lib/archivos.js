// Reglas y textos de los archivos en Google Drive (Parte D). Funciones puras.
//
// La validación de verdad la hacen las Edge Functions (google-drive-upload-init y google-drive-register); esta copia
// solo sirve para avisar antes de empezar a subir. Si cambias las reglas, cámbialas también en
// supabase/functions/_shared/drive.ts.

export const TAMANO_MAXIMO = 25 * 1024 * 1024 // 25 MB
const EXTENSIONES_BLOQUEADAS = ['exe', 'bat', 'cmd', 'msi', 'scr', 'js', 'vbs', 'sh']

// Estados en los que Google no se puede usar: la página invita a ir a Conexiones.
export const ESTADOS_SIN_GOOGLE = ['no_conectado', 'reconectar', 'permisos_incompletos']

// Lo que ve el usuario según el estado que devuelve la función (o el que detecta el navegador).
export const MENSAJES_ARCHIVO = {
  no_conectado: 'Google no está conectado. Conéctalo en Conexiones.',
  reconectar: 'Google pide volver a conectar tu cuenta en Conexiones.',
  permisos_incompletos: 'Falta el permiso de Google Drive. Vuelve a conectar Google en Conexiones.',
  demasiado_grande: 'Es muy grande: el máximo es 25 MB.',
  tipo_no_permitido: 'Ese tipo de archivo no está permitido (programas y scripts).',
  sin_conexion: 'Sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.',
  sin_respuesta: 'No se pudo enviar el archivo a Google. Revisa tu conexión e inténtalo de nuevo.',
  error: 'No se pudo subir. Inténtalo de nuevo.',
}

// Extensión en minúsculas, sin los puntos o espacios del final (Windows los ignora: "virus.exe." es un .exe).
function extension(nombre) {
  const limpio = nombre.toLowerCase().replace(/[\s.]+$/, '')
  return /\.([^.]+)$/.exec(limpio)?.[1] ?? ''
}

// Motivo por el que no se puede subir un archivo del navegador (File), o null si está bien.
export function validarArchivoLocal(archivo) {
  if (EXTENSIONES_BLOQUEADAS.includes(extension(archivo.name))) return 'tipo_no_permitido'
  if (archivo.size > TAMANO_MAXIMO) return 'demasiado_grande'
  return null
}

// 1536 -> '1.5 KB'
export function formatearTamano(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TIPOS = [
  [/^application\/pdf$/, 'PDF'],
  [/^image\//, 'Imagen'],
  [/^video\//, 'Video'],
  [/^audio\//, 'Audio'],
  [/wordprocessingml|msword|opendocument\.text/, 'Word'],
  [/spreadsheetml|ms-excel|opendocument\.spreadsheet|text\/csv/, 'Hoja de cálculo'],
  [/presentationml|ms-powerpoint|opendocument\.presentation/, 'Presentación'],
  [/zip|rar|7z|tar|gzip/, 'Comprimido'],
  [/^text\//, 'Texto'],
]

// Tipo en palabras ('PDF', 'Imagen'…); si no se reconoce, la extensión en mayúsculas.
export function tipoLegible(mime, nombre) {
  const encontrado = TIPOS.find(([patron]) => patron.test(mime ?? ''))
  if (encontrado) return encontrado[1]
  const ext = extension(nombre ?? '')
  return ext ? ext.toUpperCase() : 'Archivo'
}

export const enlaceCarpetaDrive = (idCarpeta) => `https://drive.google.com/drive/folders/${encodeURIComponent(idCarpeta)}`

// Cuántos archivos tiene un curso que viene de `courses` con `archivos(count)`.
export const contarArchivos = (curso) => curso.archivos?.[0]?.count ?? 0
