import { useEffect, useState } from 'react'
import { idsDescendientes } from '../lib/arbol'
import {
  actualizarEvaluacion,
  borrarEvaluacion,
  crearEvaluacion,
  crearEvaluaciones,
  listarEvaluaciones,
} from '../lib/promediosApi'

// Carga las evaluaciones (filas planas) de un curso y permite agregar, editar y borrar.
// Cada cambio se guarda en Supabase y, si salió bien, también en la lista en pantalla.
export function useEvaluaciones(cursoId) {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    listarEvaluaciones(cursoId)
      .then((data) => activo && setFilas(data))
      .catch(() => activo && setError('No se pudieron cargar las evaluaciones.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [cursoId])

  // Siguiente "orden" libre entre los hijos de padreId (los nodos nuevos van al final).
  function siguienteOrden(padreId) {
    return filas.filter((f) => f.parent_id === padreId).reduce((max, f) => Math.max(max, f.orden), -1) + 1
  }

  // padreId = null agrega en el primer nivel. campos = { nombre, peso? }
  // (peso puede faltar si el padre reparte en partes iguales: ahí no se usa)
  async function agregar(padreId, campos) {
    const fila = await crearEvaluacion({
      peso: 0,
      ...campos,
      course_id: cursoId,
      parent_id: padreId,
      orden: siguienteOrden(padreId),
    })
    setFilas((actuales) => [...actuales, fila])
  }

  // Agrega varios hijos de una vez: lista = [{ nombre, peso? }, ...]
  async function agregarVarios(padreId, lista) {
    const inicio = siguienteOrden(padreId)
    const nuevas = await crearEvaluaciones(
      lista.map((campos, i) => ({ peso: 0, ...campos, course_id: cursoId, parent_id: padreId, orden: inicio + i })),
    )
    setFilas((actuales) => [...actuales, ...nuevas])
  }

  async function editar(id, campos) {
    await actualizarEvaluacion(id, campos)
    setFilas((actuales) => actuales.map((f) => (f.id === id ? { ...f, ...campos } : f)))
  }

  // Edita varias filas: cambios = [{ id, campos }, ...]
  async function editarVarios(cambios) {
    await Promise.all(cambios.map(({ id, campos }) => actualizarEvaluacion(id, campos)))
    const porId = new Map(cambios.map(({ id, campos }) => [id, campos]))
    setFilas((actuales) => actuales.map((f) => (porId.has(f.id) ? { ...f, ...porId.get(f.id) } : f)))
  }

  // La base de datos borra los hijos sola; aquí los quitamos también de la pantalla.
  async function borrar(id) {
    const ids = new Set([id, ...idsDescendientes(filas, id)])
    await borrarEvaluacion(id)
    setFilas((actuales) => actuales.filter((f) => !ids.has(f.id)))
  }

  return { filas, cargando, error, agregar, agregarVarios, editar, editarVarios, borrar }
}
