import { supabase } from './supabaseClient'

// Todas las consultas pasan por RLS: solo se ven y modifican las filas del usuario.
// user_id lo rellena la base de datos sola (default auth.uid()).

// --- Cursos ---

export async function listarCursosDelUsuario() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color, created_at')
    .order('created_at')
  if (error) throw error
  return data
}

export async function obtenerCurso(id) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data // null si no existe o no es del usuario
}

export async function crearCurso(campos) {
  const { data, error } = await supabase.from('courses').insert(campos).select().single()
  if (error) throw error
  return data
}

export async function actualizarCurso(id, campos) {
  const { error } = await supabase.from('courses').update(campos).eq('id', id)
  if (error) throw error
}

// Borrar un curso borra también todas sus evaluaciones (on delete cascade).
// Los pendientes de ese curso se conservan, solo quedan "sin curso".
export async function borrarCurso(id) {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

// --- Evaluaciones (nodos del árbol) ---

// Devuelve las filas "planas" del curso; lib/arbol.js las convierte en árbol.
export async function listarEvaluaciones(cursoId) {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('course_id', cursoId)
    .order('orden')
  if (error) throw error
  return data
}

export async function crearEvaluacion(campos) {
  const { data, error } = await supabase.from('evaluations').insert(campos).select().single()
  if (error) throw error
  return data
}

// Inserta varias evaluaciones de una vez (ej. "Laboratorio 1" a "Laboratorio 6").
export async function crearEvaluaciones(lista) {
  const { data, error } = await supabase.from('evaluations').insert(lista).select()
  if (error) throw error
  return data
}

export async function actualizarEvaluacion(id, campos) {
  const { error } = await supabase.from('evaluations').update(campos).eq('id', id)
  if (error) throw error
}

// Borrar un nodo borra también a todos sus descendientes (on delete cascade en parent_id).
export async function borrarEvaluacion(id) {
  const { error } = await supabase.from('evaluations').delete().eq('id', id)
  if (error) throw error
}

// Todas las evaluaciones del usuario (de todos sus cursos) en una sola consulta.
// RLS devuelve solo las suyas. Sirve para calcular el promedio de cada curso en la lista.
export async function listarTodasLasEvaluaciones() {
  const { data, error } = await supabase.from('evaluations').select('*').order('orden')
  if (error) throw error
  return data
}

// Cursos con TODAS sus evaluaciones anidadas, en una sola consulta (evaluations(*) usa la
// clave foránea course_id). La usa Inicio para calcular la nota final de cada curso.
export async function listarCursosConEvaluaciones() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color, created_at, evaluations(*)')
    .order('created_at')
  if (error) throw error
  return data
}
