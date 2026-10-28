import { formatearNumero } from '../lib/arbol'
import { formatearNota, NOTA_APROBATORIA, NOTA_MAXIMA } from '../lib/grades'
import NotaFinal from './NotaFinal'

// Explica en una frase qué nota hace falta en lo que queda por evaluar.
function TextoNotaMinima({ resultado }) {
  const { notaMinima, evaluado } = resultado
  const falta = formatearNumero((1 - evaluado) * 100)

  if (!notaMinima) {
    return <>Completa los pesos de todos los niveles (deben sumar 100%) para calcular la nota mínima.</>
  }
  switch (notaMinima.tipo) {
    case 'necesita':
      return (
        <>
          Necesitas sacar al menos <strong>{formatearNota(notaMinima.nota)}</strong> en lo que falta ({falta}% del
          curso) para llegar a {NOTA_APROBATORIA}.
        </>
      )
    case 'asegurado':
      return <>¡Ya aseguraste el aprobado! Llegas a {NOTA_APROBATORIA} aunque saques 0 en lo que falta.</>
    case 'imposible':
      return (
        <>
          Con lo que falta ({falta}% del curso) ya no alcanzas {NOTA_APROBATORIA}, ni siquiera sacando {NOTA_MAXIMA}.
        </>
      )
    default: // 'sin-pendiente'
      return <>Ya no queda nada por evaluar: tu nota final es la que ves arriba.</>
  }
}

// Tarjeta con el resultado del curso: nota final, cuánto falta para aprobar y nota mínima.
// "resultado" es lo que devuelve calcularCurso() de lib/grades.js.
export default function ResumenPromedio({ resultado }) {
  const { puntosFaltantes, maximo, mejor, estado, pesosCompletos } = resultado

  return (
    <section
      aria-label="Resumen de notas"
      className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">Nota final</p>
      <p className="text-4xl">
        <NotaFinal resultado={resultado} />
        <span className="text-base font-normal text-gray-600 dark:text-gray-400"> / {NOTA_MAXIMA}</span>
      </p>

      <p className="mt-2 font-medium">
        {estado === 'aprobado' ? (
          <span className="text-green-700 dark:text-green-400">Aprobado ✓</span>
        ) : (
          <>
            Te faltan {formatearNumero(puntosFaltantes)} {puntosFaltantes === 1 ? 'punto' : 'puntos'} para aprobar
          </>
        )}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Máximo posible:{' '}
        <strong className={estado === 'desaprobado' ? 'text-red-600 dark:text-red-400' : ''}>
          {formatearNota(maximo)}
        </strong>
      </p>
      {mejor && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Mejor nota: {formatearNumero(mejor.nota)} en {mejor.nombre}
        </p>
      )}

      <p className="mt-3 border-t border-gray-200 pt-3 text-sm dark:border-gray-800">
        <TextoNotaMinima resultado={resultado} />
      </p>

      {!pesosCompletos && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          ⚠ Algún nivel no suma 100%, así que estos resultados son aproximados.
        </p>
      )}
    </section>
  )
}
