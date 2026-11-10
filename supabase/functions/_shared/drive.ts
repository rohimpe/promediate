// Lo que comparten las funciones de Google Drive (Parte D): validar archivos, preparar el access token,
// llamar a la API de Drive y asegurar las carpetas "Tablero de Vida" / <curso>.
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
  | 'error'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ID_DRIVE = /^[A-Za-z0-9_-]{10,200}$/

// ---------------------------------------------------------------------
// Validación de archivos (la misma lista está en src/lib/archivos.js, que solo sirve para avisar antes).
// ---------------------------------------------------------------------
export const TAMANO_MAXIMO = 25 * 1024 * 1024 // 25 MB
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

// Motivo por el que el archivo no se acepta, o null si está bien.
export function motivoRechazo(nombre: string, mime: string, tamano: number): EstadoDrive | null {
  if (EXTENSIONES_BLOQUEADAS.includes(extension(nombre))) return 'tipo_no_permitido'
  if (MIME_BLOQUEADOS.includes(mime.toLowerCase().split(';')[0].trim())) return 'tipo_no_permitido'
  if (tamano > TAMANO_MAXIMO) return 'demasiado_grande'
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
// Carpetas: "Tablero de Vida" (raíz, en profiles.drive_root_folder_id) y una por curso (courses.drive_folder_id)
// ---------------------------------------------------------------------
const MIME_CARPETA = 'application/vnd.google-apps.folder'
const NOMBRE_RAIZ = 'Tablero de Vida'

const urlArchivo = (id: string, campos: string) => `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(id)}?fields=${campos}`

// ¿La carpeta sigue existiendo (y, si se pide, dentro de `padre`)? 404, en la papelera (trashed también es true
// si se borró la carpeta que la contiene) o movida a otro sitio cuentan como "no".
async function carpetaVigente(token: string, id: string, padre?: string): Promise<boolean> {
  const r = await llamarDrive(token, 'GET', urlArchivo(id, 'id,mimeType,trashed,parents'))
  if (r.status === 404) return false
  if (!exito(r)) throw new FalloDrive(r)
  if (r.datos.trashed === true || r.datos.mimeType !== MIME_CARPETA) return false
  const padres = Array.isArray(r.datos.parents) ? r.datos.parents : []
  return !padre || padres.includes(padre)
}

async function crearCarpeta(token: string, nombre: string, padre?: string): Promise<string> {
  const r = await llamarDrive(token, 'POST', `${URL_DRIVE_ARCHIVOS}?fields=id`, {
    cuerpo: { name: nombre, mimeType: MIME_CARPETA, ...(padre ? { parents: [padre] } : {}) },
  })
  if (!exito(r) || typeof r.datos.id !== 'string') throw new FalloDrive(r)
  return r.datos.id
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
  await llamarDrive(token, 'DELETE', `${URL_DRIVE_ARCHIVOS}/${encodeURIComponent(nueva)}`).catch(() => {})
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
// borró) y guardando los ids nuevos. Lanza FalloDrive si Google responde algo inesperado.
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
  let raiz: string | null = perfil?.drive_root_folder_id ?? null

  // Lo normal: la carpeta del curso existe dentro de la raíz guardada (una sola llamada a Google).
  if (raiz && curso.drive_folder_id && (await carpetaVigente(token, curso.drive_folder_id, raiz))) {
    return curso.drive_folder_id
  }

  if (!raiz || !(await carpetaVigente(token, raiz))) {
    const nueva = await crearCarpeta(token, NOMBRE_RAIZ)
    raiz = await guardarCarpeta(token, 'profiles', { id: userId }, 'drive_root_folder_id', raiz, nueva)
  }

  let carpeta = curso.drive_folder_id
  if (!carpeta || !(await carpetaVigente(token, carpeta, raiz))) {
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
