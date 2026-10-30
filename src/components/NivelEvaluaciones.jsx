import { useState } from 'react'
import { descartesEfectivos, esIguales, formatearNumero, revisarNivel, sumaPesos } from '../lib/arbol'
import ControlesGrupo from './ControlesGrupo'
import FormIguales from './FormIguales'
import FormNodo from './FormNodo'
import NotaColor from './NotaColor'
import NotaEditable from './NotaEditable'

const BOTON =
  'rounded-lg border border-gray-300 px-2.5 py-1 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

// Aviso cuando los pesos de un nivel no cuadran (pesos relativos: cada nivel debe sumar 100%).
function AvisoPesos({ problema, padre }) {
  const { suma, diferencia } = problema
  const d = formatearNumero(Math.abs(diferencia))
  const donde = padre ? padre.nombre : 'el curso'
  const texto =
    diferencia > 0
      ? `Suman ${formatearNumero(suma)}%: faltan ${d}% para completar ${donde}.`
      : `Suman ${formatearNumero(suma)}%: sobran ${d}% en ${donde} (deben sumar 100%).`
  return (
    <p
      role="status"
      className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      ⚠ {texto}
    </p>
  )
}

function Flecha({ abierta }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`mt-1 size-4 shrink-0 text-gray-600 transition-transform dark:text-gray-400 ${abierta ? 'rotate-90' : ''}`}
    >
      <path d="M7 4l6 6-6 6V4z" />
    </svg>
  )
}

// Un nivel del árbol: los hermanos que comparten padre (padre = null es el primer nivel).
// Muestra el aviso de pesos (si hace falta) y cada nodo. Cada rama vuelve a usar
// NivelEvaluaciones para sus hijos (recursión).
//   resultado: lo que devuelve calcularCurso() (pesos efectivos y nota de cada nodo)
//   ramas:     de useRamasAbiertas(): qué ramas están abiertas
//   acciones:  onAgregar, onAgregarIguales, onEditar, onBorrar, onCambiarReparto, onCambiarDescarte
export default function NivelEvaluaciones({ nodos, padre = null, resultado, ...resto }) {
  const problema = revisarNivel(nodos, padre)
  return (
    <div className="space-y-2">
      {problema && <AvisoPesos problema={problema} padre={padre} />}
      <ul className="space-y-2">
        {nodos.map((n) => (
          <Nodo key={n.id} nodo={n} padre={padre} resultado={resultado} {...resto} />
        ))}
      </ul>
    </div>
  )
}

function Nodo({ nodo, padre, resultado, ramas, ...acciones }) {
  const { onAgregar, onAgregarIguales, onEditar, onBorrar, onCambiarReparto, onCambiarDescarte } = acciones
  const [modo, setModo] = useState(null) // null | 'editar' | 'hijo' | 'iguales'
  const esHoja = nodo.hijos.length === 0
  const abierta = ramas.estaAbierta(nodo.id)
  const peso = resultado.pesos.get(nodo.id) // % de su padre
  const aporte = resultado.aportes.get(nodo.id) // % del curso entero
  const aportePadre = padre ? resultado.aportes.get(padre.id) : 100
  const detalle = resultado.porNodo.get(nodo.id)
  const descartada = detalle?.descartada
  const pesoCalculado = esIguales(padre) // su peso lo pone el grupo, no el usuario

  // Un nodo con hijos ya no es una prueba con nota propia: su nota se borrará.
  function confirmarSiTieneNota() {
    return (
      nodo.nota == null ||
      window.confirm(
        `"${nodo.nombre}" tiene la nota ${nodo.nota}. Al agregarle subdivisiones, esa nota se borrará. ¿Continuar?`,
      )
    )
  }

  function empezar(nuevoModo) {
    if (!confirmarSiTieneNota()) return
    // Agregar partes iguales a un grupo manual lo convierte entero a partes iguales.
    if (
      nuevoModo === 'iguales' &&
      nodo.hijos.length > 0 &&
      !esIguales(nodo) &&
      !window.confirm(
        `"${nodo.nombre}" pasará a repartir su peso en partes iguales entre TODAS sus subdivisiones (las que ya tiene y las nuevas). ¿Continuar?`,
      )
    ) {
      return
    }
    setModo(nuevoModo)
  }

  // Peso relativo (grande) y, en pequeño, lo que aporta al curso entero. En el primer nivel
  // los dos son iguales, así que no se repite.
  const pesoBadge = (
    <span className={`flex shrink-0 flex-col items-end gap-0.5 ${descartada ? 'line-through opacity-60' : ''}`}>
      <span
        title={pesoCalculado ? 'Parte igual del grupo (se calcula sola)' : padre ? `Peso dentro de ${padre.nombre}` : 'Peso en el curso'}
        className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
          pesoCalculado
            ? 'border border-dashed border-indigo-300 text-indigo-800 dark:border-indigo-800 dark:text-indigo-300'
            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
        }`}
      >
        {formatearNumero(peso)}%
      </span>
      {padre && (
        <span className="text-xs text-gray-600 dark:text-gray-400">= {formatearNumero(aporte)}% del curso</span>
      )}
    </span>
  )

  const etiquetaDescartada = descartada && (
    <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 align-middle text-xs font-medium text-gray-700 no-underline dark:bg-gray-800 dark:text-gray-300">
      descartada
    </span>
  )

  const n = nodo.hijos.length
  const N = descartesEfectivos(nodo)
  const textoGrupo = [
    `${n} ${n === 1 ? 'subdivisión' : 'subdivisiones'}`,
    esIguales(nodo) && (N > 0 ? `partes iguales, descarta ${N}` : 'partes iguales'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <div
        className={`rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 ${
          descartada ? 'opacity-70' : ''
        }`}
      >
        {modo === 'editar' ? (
          <FormNodo
            inicial={nodo}
            conPeso={!pesoCalculado}
            padreNombre={padre?.nombre}
            aportePadre={aportePadre}
            textoBoton="Guardar cambios"
            onCancelar={() => setModo(null)}
            onGuardar={async (campos) => {
              await onEditar(nodo, campos)
              setModo(null)
            }}
          />
        ) : (
          <>
            {esHoja ? (
              // Prueba (hoja): nombre, peso y la nota editable ahí mismo.
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    <span className={descartada ? 'line-through' : ''}>{nodo.nombre}</span>
                    {etiquetaDescartada}
                  </p>
                  <NotaEditable nota={nodo.nota} onGuardar={(valor) => onEditar(nodo, { nota: valor })} />
                </div>
                {pesoBadge}
              </div>
            ) : (
              // Rama: todo el encabezado es un botón que abre y cierra las subdivisiones.
              <button
                type="button"
                onClick={() => ramas.alternar(nodo.id)}
                aria-expanded={abierta}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <Flecha abierta={abierta} />
                  <span className="min-w-0">
                    <span className="block font-medium break-words">
                      <span className={descartada ? 'line-through' : ''}>{nodo.nombre}</span>
                      {etiquetaDescartada}
                    </span>
                    <span className="block text-sm text-gray-600 dark:text-gray-400">
                      Promedio: <NotaColor valor={detalle?.promedio} vacio="sin notas aún" />
                      {` · ${textoGrupo}`}
                    </span>
                  </span>
                </span>
                {pesoBadge}
              </button>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setModo('editar')} className={BOTON}>
                Editar
              </button>
              <button onClick={() => empezar('hijo')} className={BOTON}>
                + Subdivisión
              </button>
              <button onClick={() => empezar('iguales')} className={BOTON}>
                + Subdivisiones iguales
              </button>
              <button
                onClick={() => onBorrar(nodo)}
                className="rounded-lg border border-red-300 px-2.5 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Borrar
              </button>
            </div>
          </>
        )}

        {modo === 'hijo' && (
          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
            <FormNodo
              conPeso={!esIguales(nodo)}
              padreNombre={nodo.nombre}
              aportePadre={aporte}
              pesoSugerido={formatearNumero(Math.max(0, 100 - sumaPesos(nodo.hijos)))}
              textoBoton="Agregar"
              onCancelar={() => setModo(null)}
              onGuardar={async (campos) => {
                await onAgregar(nodo, campos)
                ramas.abrir(nodo.id) // que se vea enseguida la subdivisión nueva
                setModo(null)
              }}
            />
          </div>
        )}

        {modo === 'iguales' && (
          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
            <FormIguales
              nombreInicial={nodo.nombre}
              desde={n + 1}
              onCancelar={() => setModo(null)}
              onGuardar={async (base, cantidad) => {
                await onAgregarIguales(nodo, base, cantidad)
                ramas.abrir(nodo.id)
                setModo(null)
              }}
            />
          </div>
        )}
      </div>

      {!esHoja && abierta && (
        <div className="mt-2 ml-2 space-y-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
          <ControlesGrupo
            nodo={nodo}
            onCambiarReparto={(reparto) => onCambiarReparto(nodo, reparto)}
            onCambiarDescarte={(valor) => onCambiarDescarte(nodo, valor)}
          />
          <NivelEvaluaciones nodos={nodo.hijos} padre={nodo} resultado={resultado} ramas={ramas} {...acciones} />
        </div>
      )}
    </li>
  )
}
