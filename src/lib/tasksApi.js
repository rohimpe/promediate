import { registrarError } from './errores'
import { supabase } from './supabaseClient'

// Todas las consultas pasan por RLS: Supabase solo devuelve / modifica las
// filas con user_id = auth.uid(). user_id lo rellena la base de datos sola.

// Tareas del usuario, con el nombre y color de su curso.
export async function listarTareas() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, courses(nombre, color)')
  if (error) throw registrarError(error)
  return data
}

export async function obtenerTarea(id) {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw registrarError(error)
  return data // null si no existe o no es del usuario
}

// Devuelve la fila creada (con su curso) para poder agregarla a la lista en pantalla.
export async function crearTarea(campos) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(campos)
    .select('*, courses(nombre, color)')
    .single()
  if (error) throw registrarError(error)
  return data
}

export async function actualizarTarea(id, campos) {
  const { error } = await supabase.from('tasks').update(campos).eq('id', id)
  if (error) throw registrarError(error)
}

export async function borrarTarea(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw registrarError(error)
}

export async function listarCursos() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, color')
    .order('nombre')
  if (error) throw registrarError(error)
  return data
}
