// Fase 3, parte D: carpetas propias dentro de la carpeta de un curso en el Google Drive del usuario.
//
// Petición (una de tres acciones):
//   { accion: 'crear', course_id, parent_id?, nombre }   parent_id ausente o null = en la carpeta del curso
//   { accion: 'renombrar', carpeta_id, nombre }
//   { accion: 'borrar', carpeta_id }
// Respuesta (200): { estado, carpeta?, carpetas?, archivos? }
//   estado: 'ok' | 'no_conectado' | 'reconectar' | 'permisos_incompletos' | 'nombre_invalido' | 'duplicada'
//           | 'demasiado_profunda' | 'no_encontrada' | 'error'
//   carpeta: la fila guardada (crear y renombrar, solo con 'ok')
//   carpetas, archivos: cuántas filas se quitaron (borrar, solo con 'ok')
//
// Todo se valida aquí con la service role, filtrando por el user_id del JWT: que el curso y la carpeta padre sean
// del usuario (y del mismo curso), la profundidad (máximo PROFUNDIDAD_MAXIMA niveles) y que no haya otra carpeta
// hermana con el mismo nombre. La política RLS de `carpetas` solo mira user_id.
//
// Borrar manda la carpeta de Drive a la PAPELERA (files.update trashed=true; su contenido va con ella y se puede
// recuperar desde Drive) y elimina las filas de la carpeta, sus subcarpetas y los archivos que contenían.
//
// Nunca se registran tokens ni nombres: solo mensajes genéricos y códigos.
import { corsHeaders, responderJson, responderPreflight } from '../_shared/cors.ts'
import {
  arbolDeCarpetas,
  asegurarCarpetaCurso,
  carpetaDelUsuario,
  type CarpetaPropia,
  carpetaYDescendientes,
  COLUMNAS_CARPETA,
  crearCarpeta,
  cursoDelUsuario,
  type EstadoDrive,
  estadoDeError,
  estadoDeFallo,
  exito,
  leerCarpeta,
  llamarDrive,
  nivelDeCarpeta,
  prepararDrive,
  urlArchivo,
  UUID,
} from '../_shared/drive.ts'
import { registrarFallo } from '../_shared/google.ts'
import { supabaseAdmin, usuarioDeLaPeticion } from '../_shared/supabaseAdmin.ts'

const CONTEXTO = 'google-drive-folder'
// Copias en src/lib/archivos.js (solo para avisar antes): si cambias una, cambia la otra.
const PROFUNDIDAD_MAXIMA = 4
const LARGO_MAXIMO_NOMBRE = 80

const esControl = (c: string) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127

// El nombre limpio (sin espacios en los bordes), o null si no sirve: vacío, más de 80 caracteres, con "/" o con
// caracteres de control.
function limpiarNombre(nombre: unknown): string | null {
  if (typeof nombre !== 'string') return null
  const limpio = nombre.trim()
  const caracteres = [...limpio]
  if (caracteres.length < 1 || caracteres.length > LARGO_MAXIMO_NOMBRE) return null
  if (caracteres.some((c) => c === '/' || esControl(c))) return null
  return limpio
}

const responder = (req: Request, estado: EstadoDrive, extra: Record<string, unknown> = {}) =>
  responderJson(req, { estado, ...extra }, estado === 'error' ? 500 : 200)

// ¿Hay otra carpeta hermana (mismo curso y mismo padre) con ese nombre? Sin distinguir mayúsculas, igual que el
// índice único de la base.
function hayHermanaConNombre(
  arbol: { id: string; parent_id: string | null; nombre: string }[],
  padreId: string | null,
  nombre: string,
  excepto?: string,
) {
  const buscado = nombre.toLowerCase()
  return arbol.some((c) => c.id !== excepto && c.parent_id === padreId && c.nombre.toLowerCase() === buscado)
}

// 23505 = violación de un índice único: otra petición guardó una hermana con el mismo nombre al mismo tiempo.
const esDuplicado = (codigo?: string) => codigo === '23505'

async function crear(req: Request, userId: string, cuerpo: Record<string, unknown>) {
  const { course_id, parent_id } = cuerpo
  if (typeof course_id !== 'string' || !UUID.test(course_id)) return responderJson(req, { error: 'Petición inválida' }, 400)
  if (parent_id != null && (typeof parent_id !== 'string' || !UUID.test(parent_id))) {
    return responderJson(req, { error: 'Petición inválida' }, 400)
  }
  const nombre = limpiarNombre(cuerpo.nombre)
  if (!nombre) return responder(req, 'nombre_invalido')

  const curso = await cursoDelUsuario(userId, course_id.toLowerCase(), CONTEXTO)
  if (!curso) return responder(req, 'no_encontrada')

  const arbol = await arbolDeCarpetas(userId, curso.id, CONTEXTO)
  let padre: CarpetaPropia | null = null
  if (typeof parent_id === 'string') {
    padre = await carpetaDelUsuario(userId, parent_id.toLowerCase(), CONTEXTO)
    if (!padre || padre.course_id !== curso.id) return responder(req, 'no_encontrada')
    if (nivelDeCarpeta(arbol, padre.id) + 1 > PROFUNDIDAD_MAXIMA) return responder(req, 'demasiado_profunda')
  }
  if (hayHermanaConNombre(arbol, padre?.id ?? null, nombre)) return responder(req, 'duplicada')

  const google = await prepararDrive(userId, CONTEXTO)
  if ('estado' in google) return responder(req, google.estado)

  // Dónde se crea en Drive: dentro de la carpeta padre, o en la del curso (que se crea o se recrea si hace falta).
  let destino: string
  if (padre) {
    // Si el usuario borró la carpeta padre en Drive, no se puede crear nada dentro (habría que recrear la cadena).
    if (!(await leerCarpeta(google.token, padre.drive_folder_id))) return responder(req, 'no_encontrada')
    destino = padre.drive_folder_id
  } else {
    destino = await asegurarCarpetaCurso(google.token, userId, curso)
  }

  const driveFolderId = await crearCarpeta(google.token, nombre, destino)
  const { data: fila, error } = await supabaseAdmin
    .from('carpetas')
    .insert({
      user_id: userId,
      course_id: curso.id,
      parent_id: padre?.id ?? null,
      drive_folder_id: driveFolderId,
      nombre,
    })
    .select(COLUMNAS_CARPETA)
    .single()
  if (error) {
    // No se guardó: se borra la carpeta recién creada para no dejarla huérfana en Drive.
    await llamarDrive(google.token, 'DELETE', urlArchivo(driveFolderId)).catch(() => {})
    if (esDuplicado(error.code)) return responder(req, 'duplicada')
    registrarFallo(`${CONTEXTO}: guardar carpeta`, error.code)
    return responder(req, 'error')
  }
  return responder(req, 'ok', { carpeta: fila })
}

async function renombrar(req: Request, userId: string, cuerpo: Record<string, unknown>) {
  const { carpeta_id } = cuerpo
  if (typeof carpeta_id !== 'string' || !UUID.test(carpeta_id)) return responderJson(req, { error: 'Petición inválida' }, 400)
  const nombre = limpiarNombre(cuerpo.nombre)
  if (!nombre) return responder(req, 'nombre_invalido')

  const carpeta = await carpetaDelUsuario(userId, carpeta_id.toLowerCase(), CONTEXTO)
  if (!carpeta) return responder(req, 'no_encontrada')
  if (carpeta.nombre === nombre) return responder(req, 'ok', { carpeta })

  const arbol = await arbolDeCarpetas(userId, carpeta.course_id, CONTEXTO)
  if (hayHermanaConNombre(arbol, carpeta.parent_id, nombre, carpeta.id)) return responder(req, 'duplicada')

  const google = await prepararDrive(userId, CONTEXTO)
  if ('estado' in google) return responder(req, google.estado)

  const r = await llamarDrive(google.token, 'PATCH', urlArchivo(carpeta.drive_folder_id, 'id'), { cuerpo: { name: nombre } })
  if (r.status === 404 || r.status === 410) return responder(req, 'no_encontrada')
  if (!exito(r)) {
    registrarFallo(`${CONTEXTO}: renombrar en Drive`, `${r.status} ${r.motivo}`.trim())
    return responder(req, estadoDeFallo(r))
  }

  const { data: fila, error } = await supabaseAdmin
    .from('carpetas')
    .update({ nombre })
    .eq('id', carpeta.id)
    .eq('user_id', userId)
    .select(COLUMNAS_CARPETA)
    .single()
  if (error) {
    // Drive ya tiene el nombre nuevo: se intenta devolverle el anterior para que ambos coincidan.
    await llamarDrive(google.token, 'PATCH', urlArchivo(carpeta.drive_folder_id, 'id'), {
      cuerpo: { name: carpeta.nombre },
    }).catch(() => {})
    if (esDuplicado(error.code)) return responder(req, 'duplicada')
    registrarFallo(`${CONTEXTO}: renombrar fila`, error.code)
    return responder(req, 'error')
  }
  return responder(req, 'ok', { carpeta: fila })
}

async function borrar(req: Request, userId: string, cuerpo: Record<string, unknown>) {
  const { carpeta_id } = cuerpo
  if (typeof carpeta_id !== 'string' || !UUID.test(carpeta_id)) return responderJson(req, { error: 'Petición inválida' }, 400)

  const carpeta = await carpetaDelUsuario(userId, carpeta_id.toLowerCase(), CONTEXTO)
  // Ya no existe (o es de otro usuario): no hay nada que borrar.
  if (!carpeta) return responder(req, 'ok', { carpetas: 0, archivos: 0 })

  const google = await prepararDrive(userId, CONTEXTO)
  if ('estado' in google) return responder(req, google.estado)

  const arbol = await arbolDeCarpetas(userId, carpeta.course_id, CONTEXTO)
  const ids = carpetaYDescendientes(arbol, carpeta.id)

  // A la papelera (no borrado definitivo). 404 / 410: ya no estaba en Drive, así que cuenta como borrada.
  const r = await llamarDrive(google.token, 'PATCH', urlArchivo(carpeta.drive_folder_id, 'id'), {
    cuerpo: { trashed: true },
  })
  if (!exito(r) && r.status !== 404 && r.status !== 410) {
    registrarFallo(`${CONTEXTO}: enviar a la papelera`, `${r.status} ${r.motivo}`.trim())
    return responder(req, estadoDeFallo(r))
  }

  // Primero los archivos: si se borrara antes la carpeta, "on delete set null" los dejaría en la raíz del curso.
  const { data: archivosBorrados, error: errorArchivos } = await supabaseAdmin
    .from('archivos')
    .delete()
    .eq('user_id', userId)
    .in('carpeta_id', ids)
    .select('id')
  if (errorArchivos) {
    registrarFallo(`${CONTEXTO}: borrar archivos`, errorArchivos.code)
    return responder(req, 'error')
  }
  const { data: carpetasBorradas, error: errorCarpetas } = await supabaseAdmin
    .from('carpetas')
    .delete()
    .eq('user_id', userId)
    .in('id', ids)
    .select('id')
  if (errorCarpetas) {
    registrarFallo(`${CONTEXTO}: borrar carpetas`, errorCarpetas.code)
    return responder(req, 'error')
  }

  return responder(req, 'ok', { carpetas: carpetasBorradas?.length ?? 0, archivos: archivosBorrados?.length ?? 0 })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responderPreflight(req)
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders(req) })

  try {
    // El user_id sale del JWT verificado contra Supabase Auth, nunca del cuerpo.
    const userId = await usuarioDeLaPeticion(req)
    if (!userId) return responderJson(req, { error: 'No autorizado' }, 401)

    const cuerpo = await req.json().catch(() => null)
    if (typeof cuerpo !== 'object' || cuerpo === null) return responderJson(req, { error: 'Petición inválida' }, 400)

    switch (cuerpo.accion) {
      case 'crear':
        return await crear(req, userId, cuerpo)
      case 'renombrar':
        return await renombrar(req, userId, cuerpo)
      case 'borrar':
        return await borrar(req, userId, cuerpo)
      default:
        return responderJson(req, { error: 'Petición inválida' }, 400)
    }
  } catch (e) {
    return responder(req, estadoDeError(e, CONTEXTO))
  }
})
