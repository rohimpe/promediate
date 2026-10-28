import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import CursoForm from '../components/CursoForm'
import NotaFinal from '../components/NotaFinal'
import {
  actualizarCurso,
  borrarCurso,
  crearCurso,
  listarCursosDelUsuario,
  listarTodasLasEvaluaciones,
} from '../lib/promediosApi'
import { construirArbol } from '../lib/arbol'
import { calcularCurso } from '../lib/grades'

// Lista de cursos del usuario. Cada curso abre su árbol de evaluaciones.
export default function Promedios() {
  const [cursos, setCursos] = useState([])
  const [evaluaciones, setEvaluaciones] = useState([]) // filas planas de todos los cursos
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Qué formulario está abierto: 'nuevo', el id de un curso (editando) o null.
  const [formAbierto, setFormAbierto] = useState(null)

  useEffect(() => {
    let activo = true
    Promise.all([listarCursosDelUsuario(), listarTodasLasEvaluaciones()])
      .then(([listaCursos, listaEvaluaciones]) => {
        if (!activo) return
        setCursos(listaCursos)
        setEvaluaciones(listaEvaluaciones)
      })
      .catch(() => activo && setError('No se pudieron cargar los cursos.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  // La nota final de cada curso se calcula al mostrarla, con las evaluaciones de ese curso.
  // Devuelve null si el curso todavía no tiene evaluaciones.
  function resultadoDe(cursoId) {
    const filas = evaluaciones.filter((f) => f.course_id === cursoId)
    return filas.length > 0 ? calcularCurso(construirArbol(filas)) : null
  }

  async function agregar(campos) {
    const curso = await crearCurso(campos)
    setCursos((actuales) => [...actuales, curso])
    setFormAbierto(null)
  }

  async function editar(id, campos) {
    await actualizarCurso(id, campos)
    setCursos((actuales) => actuales.map((c) => (c.id === id ? { ...c, ...campos } : c)))
    setFormAbierto(null)
  }

  async function borrar(curso) {
    const ok = window.confirm(
      `¿Borrar el curso "${curso.nombre}" y todas sus evaluaciones? Tus pendientes se conservan, pero quedarán sin curso. No se puede deshacer.`,
    )
    if (!ok) return
    setError('')
    try {
      await borrarCurso(curso.id)
      setCursos((actuales) => actuales.filter((c) => c.id !== curso.id))
    } catch {
      setError('No se pudo borrar el curso. Inténtalo de nuevo.')
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Promedios</h1>
        {formAbierto !== 'nuevo' && (
          <button
            onClick={() => setFormAbierto('nuevo')}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Agregar curso
          </button>
        )}
      </div>

      {formAbierto === 'nuevo' && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <CursoForm textoBoton="Crear curso" onGuardar={agregar} onCancelar={() => setFormAbierto(null)} />
        </div>
      )}

      {cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!cargando && !error && cursos.length === 0 && formAbierto !== 'nuevo' && (
        <p className="text-gray-600 dark:text-gray-400">
          Aún no tienes cursos. Crea el primero con “+ Agregar curso”.
        </p>
      )}

      <ul className="space-y-3">
        {cursos.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            {formAbierto === c.id ? (
              <CursoForm
                inicial={c}
                textoBoton="Guardar cambios"
                onGuardar={(campos) => editar(c.id, campos)}
                onCancelar={() => setFormAbierto(null)}
              />
            ) : (
              <>
                <Link to={`/promedios/${c.id}`} className="flex items-center gap-3 hover:underline">
                  <span
                    className="size-4 shrink-0 rounded-full bg-gray-400"
                    style={c.color ? { backgroundColor: c.color } : undefined}
                  />
                  <span className="min-w-0 font-semibold break-words">{c.nombre}</span>
                </Link>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {resultadoDe(c.id) ? (
                    <>
                      Nota final: <NotaFinal resultado={resultadoDe(c.id)} /> / 20
                    </>
                  ) : (
                    'Sin evaluaciones aún'
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/promedios/${c.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Evaluaciones
                  </Link>
                  <button
                    onClick={() => setFormAbierto(c.id)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => borrar(c)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Borrar
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
