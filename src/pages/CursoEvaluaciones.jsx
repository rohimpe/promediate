import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import FormNodo from '../components/FormNodo'
import NivelEvaluaciones from '../components/NivelEvaluaciones'
import ResumenPromedio from '../components/ResumenPromedio'
import { useEvaluaciones } from '../hooks/useEvaluaciones'
import { useRamasAbiertas } from '../hooks/useRamasAbiertas'
import { construirArbol, formatearNumero, idsDescendientes, sumaPesos } from '../lib/arbol'
import { calcularCurso } from '../lib/grades'
import { obtenerCurso } from '../lib/promediosApi'

const VOLVER = (
  <Link to="/promedios" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
    ← Volver a Promedios
  </Link>
)

// Árbol de evaluaciones de un curso.
export default function CursoEvaluaciones() {
  const { id } = useParams()
  const [curso, setCurso] = useState(null)
  const [estadoCurso, setEstadoCurso] = useState('cargando') // 'cargando' | 'listo' | 'no-encontrado' | 'error'
  const { filas, cargando, error, agregar, agregarVarios, editar, editarVarios, borrar } = useEvaluaciones(id)
  const ramas = useRamasAbiertas(id) // qué ramas están abiertas (se recuerda por curso)
  const [agregandoRaiz, setAgregandoRaiz] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')

  useEffect(() => {
    let activo = true
    obtenerCurso(id)
      .then((c) => {
        if (!activo) return
        setCurso(c)
        setEstadoCurso(c ? 'listo' : 'no-encontrado')
      })
      .catch(() => activo && setEstadoCurso('error'))
    return () => {
      activo = false
    }
  }, [id])

  if (estadoCurso === 'cargando') return <p className="text-gray-600 dark:text-gray-400">Cargando…</p>
  if (estadoCurso !== 'listo') {
    return (
      <>
        <p className="mb-2 text-gray-600 dark:text-gray-400">
          {estadoCurso === 'error' ? 'No se pudo cargar el curso.' : 'Ese curso no existe.'}
        </p>
        {VOLVER}
      </>
    )
  }

  const arbol = construirArbol(filas)
  // Las notas no se guardan: se recalculan en cada render a partir del árbol.
  const resultado = calcularCurso(arbol)

  // Agregar un nodo. padre = null agrega en el primer nivel.
  async function onAgregar(padre, campos) {
    // Si el padre era una hoja con nota, deja de serlo: su nota se borra (ya se avisó al usuario).
    if (padre && padre.nota != null) await editar(padre.id, { nota: null })
    await agregar(padre ? padre.id : null, campos)
  }

  // "Crear N subdivisiones iguales": crea "base 1" ... "base N" y pone el grupo en partes iguales.
  // Si el grupo ya tenía hijos, la numeración sigue (ej. Laboratorio 7, 8...).
  async function onAgregarIguales(nodo, base, cantidad) {
    const desde = nodo.hijos.length + 1
    const campos = { reparto: 'iguales' }
    if (nodo.nota != null) campos.nota = null // deja de ser una prueba con nota propia
    await editar(nodo.id, campos)
    await agregarVarios(
      nodo.id,
      Array.from({ length: cantidad }, (_, i) => ({ nombre: `${base} ${desde + i}` })),
    )
  }

  // Cambiar entre 'manual' y 'iguales'. Al volver a manual, cada hijo se queda con su
  // parte igual (100 / cantidad de hijos) como peso guardado, para no empezar con todos en 0%.
  async function onCambiarReparto(nodo, reparto) {
    const cambios = [{ id: nodo.id, campos: { reparto } }]
    if (reparto === 'manual' && nodo.hijos.length > 0) {
      const parte = Math.round((100 / nodo.hijos.length) * 10000) / 10000
      for (const h of nodo.hijos) cambios.push({ id: h.id, campos: { peso: parte } })
    }
    await editarVarios(cambios)
  }

  async function onBorrar(nodo) {
    const n = idsDescendientes(filas, nodo.id).length
    const extra = n > 0 ? ` y sus ${n} ${n === 1 ? 'subdivisión' : 'subdivisiones'}` : ''
    if (!window.confirm(`¿Borrar "${nodo.nombre}"${extra}? No se puede deshacer.`)) return
    setErrorBorrar('')
    try {
      await borrar(nodo.id)
      // Si era parte de un grupo con descarte, el descarte no puede quedar >= cantidad de hijos.
      const padre = filas.find((f) => f.id === nodo.parent_id)
      if (padre?.reparto === 'iguales') {
        const quedan = filas.filter((f) => f.parent_id === padre.id && f.id !== nodo.id).length
        const maximo = Math.max(0, quedan - 1)
        if (padre.descartar_peores > maximo) await editar(padre.id, { descartar_peores: maximo })
      }
    } catch {
      setErrorBorrar('No se pudo borrar. Inténtalo de nuevo.')
    }
  }

  return (
    <>
      <div className="mb-2">{VOLVER}</div>
      <div className="mb-4 flex items-center gap-3">
        <span
          className="size-4 shrink-0 rounded-full bg-gray-400"
          style={curso.color ? { backgroundColor: curso.color } : undefined}
        />
        <h1 className="min-w-0 text-2xl font-bold break-words">{curso.nombre}</h1>
      </div>

      {!cargando && !error && arbol.length > 0 && <ResumenPromedio resultado={resultado} />}

      {cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}
      {(error || errorBorrar) && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error || errorBorrar}
        </p>
      )}

      {!cargando && !error && arbol.length === 0 && !agregandoRaiz && (
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Este curso aún no tiene evaluaciones. Agrega la primera, por ejemplo “Examen final” con 30% del curso.
        </p>
      )}

      {arbol.length > 0 && (
        <NivelEvaluaciones
          nodos={arbol}
          resultado={resultado}
          ramas={ramas}
          onAgregar={onAgregar}
          onAgregarIguales={onAgregarIguales}
          onEditar={(nodo, campos) => editar(nodo.id, campos)}
          onBorrar={onBorrar}
          onCambiarReparto={onCambiarReparto}
          onCambiarDescarte={(nodo, valor) => editar(nodo.id, { descartar_peores: valor })}
        />
      )}

      <div className="mt-4">
        {agregandoRaiz ? (
          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <FormNodo
              pesoSugerido={formatearNumero(Math.max(0, 100 - sumaPesos(arbol)))}
              textoBoton="Agregar"
              onCancelar={() => setAgregandoRaiz(false)}
              onGuardar={async (campos) => {
                await onAgregar(null, campos)
                setAgregandoRaiz(false)
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setAgregandoRaiz(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Agregar evaluación
          </button>
        )}
      </div>
    </>
  )
}
