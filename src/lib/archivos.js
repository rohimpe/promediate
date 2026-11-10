// Reglas y textos de los archivos en Google Drive (Parte D). Funciones puras.
//
// La validación de verdad la hacen las Edge Functions (google-drive-upload-init y google-drive-register); esta copia
// solo sirve para avisar antes de empezar a subir. Si cambias las reglas, cámbialas también en
// supabase/functions/_shared/drive.ts (tipos) y en google-drive-upload-init (tamaño).

// Copia del tope de la Edge Function (MAX_TAMANO_ARCHIVO en google-drive-upload-init), que es la que manda.
// Es el único lugar del frontend con este número: los textos se arman a partir de él.
export const MAX_TAMANO_ARCHIVO = 100 * 1024 * 1024 // 100 MB
export const TEXTO_TAMANO_MAXIMO = `${MAX_TAMANO_ARCHIVO / (1024 * 1024)} MB`
const EXTENSIONES_BLOQUEADAS = ['exe', 'bat', 'cmd', 'msi', 'scr', 'js', 'vbs', 'sh']

// Estados en los que Google no se puede usar: la página invita a ir a Conexiones.
export const ESTADOS_SIN_GOOGLE = ['no_conectado', 'reconectar', 'permisos_incompletos']

// Lo que ve el usuario según el estado que devuelve la función (o el que detecta el navegador).
export const MENSAJES_ARCHIVO = {
  no_conectado: 'Google no está conectado. Conéctalo en Conexiones.',
  reconectar: 'Google pide volver a conectar tu cuenta en Conexiones.',
  permisos_incompletos: 'Falta el permiso de Google Drive. Vuelve a conectar Google en Conexiones.',
  demasiado_grande: `Es muy grande: el máximo es ${TEXTO_TAMANO_MAXIMO}.`,
  tipo_no_permitido: 'Ese tipo de archivo no está permitido (programas y scripts).',
  sin_conexion: 'Sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.',
  sin_respuesta: 'No se pudo enviar el archivo a Google. Revisa tu conexión e inténtalo de nuevo.',
  no_encontrada: 'Esta carpeta ya no existe en tu Google Drive. Bórrala aquí y vuelve a crearla.',
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
  if (archivo.size > MAX_TAMANO_ARCHIVO) return 'demasiado_grande'
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

// Cuántos archivos tiene un curso que viene de `courses` con `archivos(count)`. Incluye los de sus carpetas: cada
// archivo guarda su course_id aunque esté dentro de una carpeta.
export const contarArchivos = (curso) => curso.archivos?.[0]?.count ?? 0
// Cuántas carpetas propias tiene (a cualquier profundidad), con `carpetas(count)`.
export const contarCarpetas = (curso) => curso.carpetas?.[0]?.count ?? 0

// ---------------------------------------------------------------------
// Carpetas propias dentro de la carpeta de un curso (tabla `carpetas`).
// Copias de las reglas de google-drive-folder (la que manda): si cambias una, cambia la otra.
// ---------------------------------------------------------------------
export const PROFUNDIDAD_MAXIMA_CARPETAS = 4
export const LARGO_MAXIMO_NOMBRE_CARPETA = 80

export const MENSAJES_CARPETA = {
  no_conectado: MENSAJES_ARCHIVO.no_conectado,
  reconectar: MENSAJES_ARCHIVO.reconectar,
  permisos_incompletos: MENSAJES_ARCHIVO.permisos_incompletos,
  nombre_invalido: `El nombre debe tener entre 1 y ${LARGO_MAXIMO_NOMBRE_CARPETA} caracteres y no puede llevar "/".`,
  duplicada: 'Ya hay una carpeta con ese nombre aquí.',
  demasiado_profunda: `Solo se pueden anidar ${PROFUNDIDAD_MAXIMA_CARPETAS} niveles de carpetas.`,
  no_encontrada: 'Esa carpeta ya no existe en tu Google Drive (quizá la borraste allí). Bórrala aquí y vuelve a crearla.',
  error: 'No se pudo completar. Inténtalo de nuevo.',
}

// 'nombre_invalido' si el nombre no sirve (vacío, muy largo, con "/" o caracteres de control); si no, null.
export function validarNombreCarpeta(nombre) {
  const caracteres = [...nombre.trim()]
  if (caracteres.length < 1 || caracteres.length > LARGO_MAXIMO_NOMBRE_CARPETA) return 'nombre_invalido'
  const malo = (c) => c === '/' || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
  return caracteres.some(malo) ? 'nombre_invalido' : null
}

// Las carpetas desde la del curso hasta la indicada: [Carpeta, Subcarpeta, …]. Vacío si id es null o no existe.
// El tope de vueltas evita un bucle infinito si los datos tuvieran un ciclo.
export function rutaDeCarpeta(carpetas, id) {
  const porId = new Map(carpetas.map((c) => [c.id, c]))
  const ruta = []
  let actual = porId.get(id)
  while (actual && ruta.length <= carpetas.length) {
    ruta.unshift(actual)
    actual = porId.get(actual.parent_id)
  }
  return ruta
}

// Los ids de la carpeta y de todas las que contiene, a cualquier profundidad.
export function idsCarpetaYDescendientes(carpetas, id) {
  const ids = new Set([id])
  let creciendo = true
  while (creciendo) {
    creciendo = false
    for (const c of carpetas) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id)
        creciendo = true
      }
    }
  }
  return ids
}

// Todo lo que hay dentro de una carpeta, a cualquier profundidad: { subcarpetas, archivos }.
export function contenidoDeCarpeta(carpetas, archivos, id) {
  const ids = idsCarpetaYDescendientes(carpetas, id)
  return {
    subcarpetas: ids.size - 1,
    archivos: archivos.filter((a) => a.carpeta_id && ids.has(a.carpeta_id)).length,
  }
}

// Cuántos elementos (carpetas y archivos) hay directamente dentro de una carpeta.
export const elementosDirectos = (carpetas, archivos, id) =>
  carpetas.filter((c) => c.parent_id === id).length + archivos.filter((a) => a.carpeta_id === id).length

// Orden alfabético en español, sin distinguir mayúsculas y con los números en orden natural (2 antes que 10).
export const compararNombres = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true })

// "3 elementos", "1 elemento", "Vacía"
export const textoElementos = (n) => (n === 0 ? 'Vacía' : `${n} ${n === 1 ? 'elemento' : 'elementos'}`)

// "2 subcarpetas y 5 archivos", "1 archivo", "" (si está vacía)
export function textoContenido({ subcarpetas, archivos }) {
  const partes = []
  if (subcarpetas > 0) partes.push(`${subcarpetas} ${subcarpetas === 1 ? 'subcarpeta' : 'subcarpetas'}`)
  if (archivos > 0) partes.push(`${archivos} ${archivos === 1 ? 'archivo' : 'archivos'}`)
  return partes.join(' y ')
}
