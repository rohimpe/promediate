import { aportesAlCurso, arbolCompleto, descartesEfectivos, esIguales, pesosRelativos } from './arbol'

// ---------------------------------------------------------------------
// Cálculo de notas (escala vigesimal, 0 a 20). Nada de esto se guarda:
// se recalcula cada vez que se muestra.
//
// PESOS RELATIVOS AL PADRE (ver lib/arbol.js): los hijos de cada nodo suman 100.
// La nota de un nodo con hijos es  Σ (nota del hijo × peso del hijo / 100).
// Así los pesos se "multiplican hacia abajo": una prueba que pesa 50% de un grupo que pesa
// 40% de otro que pesa 70% del curso aporta  nota × 0.5 × 0.4 × 0.7  a la nota final.
//
// IDEA CENTRAL: "evaluar el curso suponiendo que cada prueba sin nota saca x".
//   x = 0  -> nota final (lo no evaluado cuenta como 0) = puntos acumulados
//   x = 20 -> máximo posible
//   nota mínima = el menor x con el que se llega a 10.5 (se busca por bisección)
// Así el descarte de peores notas funciona igual en los tres casos.
//
// Grupos:
//   manual:  suma lo que aporta cada hijo con su propio peso.
//   iguales: n hijos y N descartes -> cuentan las n - N mejores y cada una pesa
//            100 / (n - N). Las pruebas sin nota valen x, así que con
//            x = 0 son las primeras en descartarse: si hay menos de n - N notas
//            ingresadas, cuentan todas.
// ---------------------------------------------------------------------

export const NOTA_APROBATORIA = 10.5
export const NOTA_MAXIMA = 20

const EPS = 1e-9

// Evalúa un nodo suponiendo que las pruebas sin nota sacan x. Devuelve:
//   valor:    la nota del nodo (0 a 20): la de la prueba, o Σ nota del hijo × peso del hijo / 100
//   evaluado: fracción del nodo (0 a 1) que tiene nota y cuenta
//   conNota:  si tiene al menos una nota ingresada
// Si se pasa "detalle" (un Map), anota ahí el resultado de cada nodo.
function evaluarNodo(nodo, pesos, x, detalle) {
  let r

  if (nodo.hijos.length === 0) {
    r = nodo.nota == null
      ? { valor: x, evaluado: 0, conNota: false }
      : { valor: Number(nodo.nota), evaluado: 1, conNota: true }
  } else {
    const hijos = nodo.hijos.map((h) => ({ nodo: h, r: evaluarNodo(h, pesos, x, detalle) }))
    let cuentan = hijos

    if (esIguales(nodo)) {
      const N = descartesEfectivos(nodo)
      // De peor a mejor (todos pesan igual). En empate se descarta antes la que no tiene nota.
      const ordenados = [...hijos].sort((a, b) => a.r.valor - b.r.valor || a.r.conNota - b.r.conNota)
      const descartados = new Set(ordenados.slice(0, N).map((h) => h.nodo.id))
      cuentan = hijos.filter((h) => !descartados.has(h.nodo.id))
      // Solo se marca "descartada" una prueba que ya tiene nota.
      if (detalle) {
        for (const h of hijos) {
          if (descartados.has(h.nodo.id) && h.r.conNota) detalle.get(h.nodo.id).descartada = true
        }
      }
    }

    r = {
      ...ponderar(cuentan, pesos),
      conNota: hijos.some((h) => h.r.conNota),
    }
  }

  if (detalle) {
    // Promedio del nodo (sobre 20) con lo que ya tiene nota y cuenta; solo tiene sentido con x = 0.
    detalle.set(nodo.id, { ...r, promedio: r.evaluado > EPS ? r.valor / r.evaluado : null, descartada: false })
  }
  return r
}

// Combina hijos: valor = Σ valor × peso / 100 ; evaluado = Σ evaluado × peso / 100.
// "hijos" es una lista de { nodo, r }.
function ponderar(hijos, pesos) {
  return hijos.reduce(
    (total, { nodo, r }) => {
      const w = pesos.get(nodo.id) / 100
      return { valor: total.valor + r.valor * w, evaluado: total.evaluado + r.evaluado * w }
    },
    { valor: 0, evaluado: 0 },
  )
}

// Nota final del curso si todas las pruebas sin nota sacan x: { valor, evaluado }.
// El primer nivel se trata como los hijos de un nodo "curso" (también suman 100).
function evaluarCurso(arbol, pesos, x, detalle) {
  return ponderar(
    arbol.map((n) => ({ nodo: n, r: evaluarNodo(n, pesos, x, detalle) })),
    pesos,
  )
}

function hayPruebasSinNota(nodos) {
  return nodos.some((n) => (n.hijos.length === 0 ? n.nota == null : hayPruebasSinNota(n.hijos)))
}

// Nota mínima que hay que sacar en TODAS las pruebas sin nota para llegar a "objetivo".
// Devuelve { tipo, nota? }:
//   'necesita'      → hay que sacar al menos "nota" en lo que falta
//   'asegurado'     → ya llegas al objetivo aunque saques 0 en lo que falta
//   'imposible'     → ni con 20 en todo lo que falta llegas
//   'sin-pendiente' → ya no queda nada por evaluar
export function notaMinimaNecesaria(arbol, pesos = pesosRelativos(arbol), objetivo = NOTA_APROBATORIA) {
  if (!hayPruebasSinNota(arbol)) return { tipo: 'sin-pendiente' }
  const nota = (x) => evaluarCurso(arbol, pesos, x).valor
  if (nota(0) >= objetivo - EPS) return { tipo: 'asegurado' }
  if (nota(NOTA_MAXIMA) < objetivo - EPS) return { tipo: 'imposible' }

  // Bisección: la nota final crece (o se mantiene) cuando x crece.
  let bajo = 0
  let alto = NOTA_MAXIMA
  for (let i = 0; i < 60; i++) {
    const medio = (bajo + alto) / 2
    if (nota(medio) >= objetivo - EPS) alto = medio
    else bajo = medio
  }
  // Se redondea HACIA ARRIBA a 2 decimales: mostrar menos de lo necesario sería engañoso.
  return { tipo: 'necesita', nota: Math.ceil(alto * 100 - 1e-6) / 100 }
}

// La prueba (hoja) con la nota más alta: { nota, nombre } o null si no hay ninguna nota.
// Si hay empate, gana la primera según el orden del árbol.
export function mejorNota(nodos) {
  let mejor = null
  for (const nodo of nodos) {
    let candidato = null
    if (nodo.hijos.length > 0) candidato = mejorNota(nodo.hijos)
    else if (nodo.nota != null) candidato = { nota: Number(nodo.nota), nombre: nodo.nombre }
    if (candidato && (!mejor || candidato.nota > mejor.nota)) mejor = candidato
  }
  return mejor
}

// Calcula todo un curso a partir de su árbol (la lista de nodos de primer nivel, con "hijos").
// Devuelve:
//   notaFinal:    puntos acumulados sobre 20 (lo que aún no tiene nota cuenta como 0)
//   maximo:       nota final si todo lo que falta sale 20
//   evaluado:     fracción del curso que ya tiene nota y cuenta (0 a 1)
//   estado:       'aprobado' | 'desaprobado' | 'neutro' (ver estadoNota)
//   puntosFaltantes: cuántos puntos faltan para llegar a 10.5 (0 si ya aprobó)
//   mejor:        { nota, nombre } de la mejor prueba, o null
//   pesosCompletos: false si algún nivel no cuadra (los resultados serían aproximados)
//   notaMinima:   ver notaMinimaNecesaria (null si los pesos no cuadran: no se puede saber)
//   pesos:        Map id -> peso relativo (% de su padre) de cada nodo
//   aportes:      Map id -> aporte real de cada nodo (% del curso entero)
//   porNodo:      Map id -> { valor, evaluado, promedio, descartada } de cada nodo
export function calcularCurso(arbol) {
  const pesos = pesosRelativos(arbol)
  const porNodo = new Map()
  const { valor: notaFinal, evaluado } = evaluarCurso(arbol, pesos, 0, porNodo)
  const maximo = evaluarCurso(arbol, pesos, NOTA_MAXIMA).valor
  const pesosCompletos = arbolCompleto(arbol)
  const estado = estadoNota({ notaFinal, maximo, pesosCompletos })

  return {
    notaFinal,
    maximo,
    evaluado,
    estado,
    puntosFaltantes: estado === 'aprobado' ? 0 : Math.ceil((NOTA_APROBATORIA - notaFinal) * 100 - 1e-6) / 100,
    mejor: mejorNota(arbol),
    pesosCompletos,
    notaMinima: pesosCompletos ? notaMinimaNecesaria(arbol, pesos) : null,
    pesos,
    aportes: aportesAlCurso(arbol, pesos),
    porNodo,
  }
}

// Color de la nota final de un curso (se usa igual en la página del curso, la lista e Inicio):
//   'aprobado'    → verde:  la nota final ya es >= 10.5
//   'desaprobado' → rojo:   ni sacando 20 en todo lo que falta se llega a 10.5
//                           (solo si los pesos cuadran; si no, no se puede afirmar)
//   'neutro'      → en otro caso: todavía se puede aprobar
export function estadoNota({ notaFinal, maximo, pesosCompletos }) {
  if (redondear(notaFinal) >= NOTA_APROBATORIA) return 'aprobado'
  if (pesosCompletos && redondear(maximo) < NOTA_APROBATORIA) return 'desaprobado'
  return 'neutro'
}

// ¿Está aprobado? Se compara con el valor ya redondeado a 2 decimales, el mismo que ve
// el usuario (así no aparece "10.50" en rojo).
export function estaAprobado(nota) {
  return redondear(nota) >= NOTA_APROBATORIA
}

// Redondea a 2 decimales con la misma regla que formatearNota (lo que ve el usuario).
function redondear(nota) {
  return Number(formatearNota(nota))
}

// 14.5714 -> '14.57'
export function formatearNota(nota) {
  return nota.toFixed(2)
}
