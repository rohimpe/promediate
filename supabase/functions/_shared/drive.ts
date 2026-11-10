// Lo que comparten las funciones de Google Drive (Parte D): validar archivos, preparar el access token,
// llamar a la API de Drive y asegurar las carpetas NOMBRE_CARPETA_RAIZ / <curso>.
//
// Nunca se registran tokens ni nombres de archivos: solo mensajes genéricos y códigos.
import {
  ErrorGoogle,
  obtenerAccessToken,
  registrarFallo,
  SCOPE_DRIVE,
  URL_DRIVE_ARCHIVOS,
} from './google.ts'
import { supabaseAdmin } from './supabaseAdmin.ts'

export type EstadoDrive =
  | 'ok'
  | 'no_conectado'
  | 'reconectar'
  | 'permisos_incompletos'
  | 'demasiado_grande'
  | 'tipo_no_permitido'
  // Carpetas propias (google-drive-folder) y subidas a una carpeta que ya no existe:
  | 'nombre_invalido'
  | 'duplicada'
  | 'demasiado_profunda'
  | 'no_encontrada'
  | 'error'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ID_DRIVE = /^[A-Za-z0-9_-]{10,200}$/

// ---------------------------------------------------------------------
// Validación de archivos (la misma lista está en src/lib/archivos.js, que solo sirve para avisar antes).
// El tope de tamaño NO está aquí: es MAX_TAMANO_ARCHIVO, en google-drive-upload-init.
// ---------------------------------------------------------------------
export const LARGO_MAXIMO_NOMBRE = 200
const EXTENSIONES_BLOQUEADAS = ['exe', 'bat', 'cmd', 'msi', 'scr', 'js', 'vbs', 'sh']
const MIME_BLOQUEADOS = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-msi',
  'application/x-sh',
  'application/x-bat',
  'application/javascript',
  'application/x-javascript',
  'text/javascript',
  'text/vbscript',
]

// Caracteres de control (saltos de línea, tabulaciones, etc.): no tienen sentido en un nombre.
const esControl = (c: string) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127

// ¿El nombre es aceptable? (no vacío, sin caracteres de control y no demasiado largo)
export function nombreValido(nombre: unknown): nombre is string {
  if (typeof nombre !== 'string') return false
  const limpio = nombre.trim()
  return limpio.length > 0 && limpio.length <= LARGO_MAXIMO_NOMBRE && ![...limpio].some(esControl)
}

// Extensión en minúsculas. Se quitan antes los puntos y espacios del final: Windows los ignora ("virus.exe." es un .exe).
function extension(nombre: string): string {
  const limpio = nombre.toLowerCase().replace(/[\s.]+$/, '')
  return /\.([^.]+)$/.exec(limpio)?.[1] ?? ''
}

// Motivo por el que el tipo de archivo no se acepta (programas y scripts), o null si está bien.
export function motivoRechazo(nombre: string, mime: string): EstadoDrive | null {
  if (EXTENSIONES_BLOQUEADAS.includes(extension(nombre))) return 'tipo_no_permitido'
  if (MIME_BLOQUEADOS.includes(mime.toLowerCase().split(';')[0].trim())) return 'tipo_no_permitido'
  return null
}

// ---------------------------------------------------------------------
// Llamadas a Google
// ---------------------------------------------------------------------
export interface RespuestaDrive {
  status: number
  motivo: string // "reason" de Google (p. ej. insufficientPermissions); nunca datos del archivo
  datos: Record<string, unknown>
  cabeceras: Headers
}

export async function llamarDrive(
  token: string,
  metodo: string,
  url: string,
  opciones: { cuerpo?: unknown; cabeceras?: Record<string, string> } = {},
): Promise<RespuestaDrive> {
  const { cuerpo, cabeceras = {} } = opciones
  const respuesta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(cuerpo ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...cabeceras,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const datos = await respuesta.json().catch(() => ({}))
  const motivo = typeof datos?.error?.errors?.[0]?.reason === 'string' ? datos.error.errors[0].reason : ''
  return { status: respuesta.status, motivo, datos: datos ?? {}, cabeceras: respuesta.headers }
}

export const exito = (r: RespuestaDrive) => r.status >= 200 && r.status < 300

// Una respuesta de Google que no se esperaba. La lanzan las funciones de carpetas.
export class FalloDrive extends Error {
  constructor(public respuesta: RespuestaDrive) {
    super(`${respuesta.status}`)
  }
}

// El estado que ve la app ante una respuesta fallida de Google.
export function estadoDeFallo(r: RespuestaDrive): EstadoDrive {
  return r.motivo === 'insufficientPermissions' || r.motivo === 'insufficientScopes' ? 'permisos_incompletos' : 'error'
}

// El estado ante un error cualquiera (de Google, del token o de la base), registrándolo con códigos.
export function estadoDeError(e: unknown, contexto: string): EstadoDrive {
  if (e instanceof FalloDrive) {
    registrarFallo(contexto, `${e.respuesta.status} ${e.respuesta.motivo}`.trim())
    return estadoDeFallo(e.respuesta)
  }
  registrarFallo(contexto)
  return 'error'
}

// ¿Se puede usar Drive? Devuelve el access token o el estado que lo impide.
export async function prepararDrive(userId: string, contexto: string): Promise<{ token: string } | { estado: EstadoDrive }> {
  const { data: conexion, error } = await supabaseAdmin
    .from('google_connections')
    .select('estado, scopes')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    registrarFallo(`${contexto}: leer conexión`, error.code)
    return { estado: 'error' }
  }
  if (!conexion) return { estado: 'no_conectado' }
  if (conexion.estado === 'reconectar') return { estado: 'reconectar' }
  // Google guarda los scopes concedidos como texto separado por espacios.
  if (!(conexion.scopes ?? '').split(' ').includes(SCOPE_DRIVE)) return { estado: 'permisos_incompletos' }

  try {
    return { token: await obtenerAccessToken(userId) }
  } catch (e) {
    // obtenerAccessToken ya registró el fallo y, si fue invalid_grant, marcó la conexión como 'reconectar'.
    if (e instanceof ErrorGoogle && e.codigo === 'invalid_grant') return { estado: 'reconectar' }
    if (e instanceof ErrorGoogle && e.codigo === 'sin_conexion') return { estado: 'no_conectado' }
    return { estado: 'error' }
  }
}

// ---------------------------------------------------------------------
// Carpetas: NOMBRE_CARPETA_RAIZ (raíz, en profiles.drive_root_folder_id) y una por curso (courses.drive_folder_id).
// Las carpetas se encuentran SIEMPRE por los ids guardados, nunca buscando por nombre.
// ---------------------------------------------------------------------
export const MIME_CARPETA = 'application/vnd.google-apps.folder'
// Nombre de la carpeta raíz en el Drive del usuario. Si cambia, las carpetas que ya existen se renombran solas en
// la siguiente subida (ver asegurarCarpetaCurso).
export const NOMBRE_CARPETA_RAIZ = 'Promediate'

export const urlArchivo = (id: string, campos = '') =>
  `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(id)}${campos ? `?fields=${campos}` : ''}`

interface Carpeta {
  nombre: string
  padres: string[]
}

// Lee una carpeta guardada (files.get). Devuelve null si ya no sirve: 404, en la papelera (trashed también es true
// si se borró la carpeta que la contiene) o no es una carpeta.
export async function leerCarpeta(token: string, id: string): Promise<Carpeta | null> {
  const r = await llamarDrive(token, 'GET', urlArchivo(id, 'id,name,mimeType,trashed,parents'))
  if (r.status === 404) return null
  if (!exito(r)) throw new FalloDrive(r)
  if (r.datos.trashed === true || r.datos.mimeType !== MIME_CARPETA) return null
  return {
    nombre: typeof r.datos.name === 'string' ? r.datos.name : '',
    padres: Array.isArray(r.datos.parents) ? r.datos.parents : [],
  }
}

export async function crearCarpeta(token: string, nombre: string, padre?: string): Promise<string> {
  const r = await llamarDrive(token, 'POST', `${URL_DRIVE_ARCHIVOS}?fields=id`, {
    cuerpo: { name: nombre, mimeType: MIME_CARPETA, ...(padre ? { parents: [padre] } : {}) },
  })
  if (!exito(r) || typeof r.datos.id !== 'string') throw new FalloDrive(r)
  return r.datos.id
}

// Renombra una carpeta (files.update). Es solo estético: si falla, se registra y la subida sigue (se vuelve a
// intentar en la próxima).
async function renombrarCarpeta(token: string, id: string, nombre: string): Promise<void> {
  try {
    const r = await llamarDrive(token, 'PATCH', urlArchivo(id, 'id'), { cuerpo: { name: nombre } })
    if (!exito(r)) registrarFallo('drive: renombrar carpeta raíz', `${r.status} ${r.motivo}`.trim())
  } catch {
    registrarFallo('drive: renombrar carpeta raíz')
  }
}

// Guarda el id de una carpeta nueva solo si nadie lo cambió mientras tanto (dos subidas a la vez desde dos pestañas).
// Si otra petición ganó, se usa su carpeta y se borra la que acabamos de crear, para no dejar duplicados.
async function guardarCarpeta(
  token: string,
  tabla: 'profiles' | 'courses',
  filtros: Record<string, string>,
  columna: string,
  anterior: string | null,
  nueva: string,
): Promise<string> {
  let consulta = supabaseAdmin.from(tabla).update({ [columna]: nueva })
  for (const [clave, valor] of Object.entries(filtros)) consulta = consulta.eq(clave, valor)
  consulta = anterior ? consulta.eq(columna, anterior) : consulta.is(columna, null)
  const { data, error } = await consulta.select('id')
  if (error) {
    registrarFallo(`drive: guardar carpeta en ${tabla}`, error.code)
    throw new Error('base de datos')
  }
  if (data.length > 0) return nueva

  let lectura = supabaseAdmin.from(tabla).select(columna)
  for (const [clave, valor] of Object.entries(filtros)) lectura = lectura.eq(clave, valor)
  const { data: fila } = await lectura.maybeSingle()
  const ganador = (fila as Record<string, string | null> | null)?.[columna] ?? null
  if (!ganador || ganador === nueva) return nueva
  await llamarDrive(token, 'DELETE', urlArchivo(nueva)).catch(() => {})
  return ganador
}

// Nombre de la carpeta del curso: el del curso, sin caracteres de control y de largo razonable.
function nombreCarpeta(nombreCurso: string): string {
  const limpio = [...nombreCurso].map((c) => (esControl(c) ? ' ' : c)).join('').trim().slice(0, 100)
  return limpio || 'Curso'
}

export interface CursoConCarpeta {
  id: string
  nombre: string
  drive_folder_id: string | null
}

// Devuelve el id de la carpeta del curso en Drive, creando la raíz y la carpeta si no existen (o si el usuario las
// borró) y guardando los ids nuevos. Si la raíz guardada tiene otro nombre (p. ej. una creada con un nombre
// anterior), la renombra a NOMBRE_CARPETA_RAIZ en vez de crear otra. Lanza FalloDrive si Google responde algo
// inesperado.
export async function asegurarCarpetaCurso(token: string, userId: string, curso: CursoConCarpeta): Promise<string> {
  const { data: perfil, error } = await supabaseAdmin
    .from('profiles')
    .select('drive_root_folder_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    registrarFallo('drive: leer perfil', error.code)
    throw new Error('base de datos')
  }
  const raizGuardada: string | null = perfil?.drive_root_folder_id ?? null

  // Las dos carpetas guardadas se leen a la vez (lo normal: dos llamadas en paralelo y nada más).
  const [infoRaiz, infoCurso] = await Promise.all([
    raizGuardada ? leerCarpeta(token, raizGuardada) : null,
    raizGuardada && curso.drive_folder_id ? leerCarpeta(token, curso.drive_folder_id) : null,
  ])

  let raiz: string
  if (raizGuardada && infoRaiz) {
    raiz = raizGuardada
    if (infoRaiz.nombre !== NOMBRE_CARPETA_RAIZ) await renombrarCarpeta(token, raiz, NOMBRE_CARPETA_RAIZ)
  } else {
    // No hay raíz guardada, o el usuario la borró (404 / papelera): se crea otra y se guarda su id.
    const nueva = await crearCarpeta(token, NOMBRE_CARPETA_RAIZ)
    raiz = await guardarCarpeta(token, 'profiles', { id: userId }, 'drive_root_folder_id', raizGuardada, nueva)
  }

  // La carpeta del curso sirve si existe y está dentro de la raíz que se usa ahora.
  let carpeta = curso.drive_folder_id
  const cursoVigente = raiz === raizGuardada && infoCurso !== null && infoCurso.padres.includes(raiz)
  if (!carpeta || !cursoVigente) {
    const nueva = await crearCarpeta(token, nombreCarpeta(curso.nombre), raiz)
    carpeta = await guardarCarpeta(
      token,
      'courses',
      { id: curso.id, user_id: userId },
      'drive_folder_id',
      carpeta,
      nueva,
    )
  }
  return carpeta
}

// El curso, solo si es del usuario (null si no existe o es de otro).
export async function cursoDelUsuario(userId: string, cursoId: string, contexto: string) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, nombre, drive_folder_id')
    .eq('id', cursoId)
    .eq('user_id', userId)
    .maybeSingle<CursoConCarpeta>()
  if (error) {
    registrarFallo(`${contexto}: leer curso`, error.code)
    throw new Error('base de datos')
  }
  return data
}

// ---------------------------------------------------------------------
// Carpetas propias del usuario dentro de la carpeta de un curso (tabla `carpetas`).
// Se leen con la service role filtrando SIEMPRE por el user_id del JWT.
// ---------------------------------------------------------------------
export interface CarpetaPropia {
  id: string
  course_id: string
  parent_id: string | null
  drive_folder_id: string
  nombre: string
}

export const COLUMNAS_CARPETA = 'id, course_id, parent_id, drive_folder_id, nombre, created_at'

// La carpeta, solo si es del usuario (null si no existe o es de otro).
export async function carpetaDelUsuario(userId: string, carpetaId: string, contexto: string) {
  const { data, error } = await supabaseAdmin
    .from('carpetas')
    .select('id, course_id, parent_id, drive_folder_id, nombre')
    .eq('id', carpetaId)
    .eq('user_id', userId)
    .maybeSingle<CarpetaPropia>()
  if (error) {
    registrarFallo(`${contexto}: leer carpeta`, error.code)
    throw new Error('base de datos')
  }
  return data
}

// Todas las carpetas del usuario en un curso, solo con lo necesario para recorrer el árbol.
export async function arbolDeCarpetas(userId: string, cursoId: string, contexto: string) {
  const { data, error } = await supabaseAdmin
    .from('carpetas')
    .select('id, parent_id, nombre')
    .eq('user_id', userId)
    .eq('course_id', cursoId)
  if (error) {
    registrarFallo(`${contexto}: leer carpetas`, error.code)
    throw new Error('base de datos')
  }
  return (data ?? []) as { id: string; parent_id: string | null; nombre: string }[]
}

// Nivel de una carpeta: 1 si está directamente en la carpeta del curso, 2 si está dentro de una de nivel 1…
// El tope de vueltas evita un bucle infinito si la base tuviera un ciclo.
export function nivelDeCarpeta(arbol: { id: string; parent_id: string | null }[], id: string): number {
  const padres = new Map(arbol.map((c) => [c.id, c.parent_id]))
  let nivel = 0
  let actual: string | null | undefined = id
  while (actual && nivel <= arbol.length) {
    nivel++
    actual = padres.get(actual)
  }
  return nivel
}

// La carpeta y todas las que contiene (a cualquier profundidad).
export function carpetaYDescendientes(arbol: { id: string; parent_id: string | null }[], id: string): string[] {
  const resultado = [id]
  for (let i = 0; i < resultado.length; i++) {
    for (const c of arbol) if (c.parent_id === resultado[i] && !resultado.includes(c.id)) resultado.push(c.id)
  }
  return resultado
}
