// El árbol de evaluaciones se guarda "plano" en la tabla evaluations: una fila por nodo,
// con parent_id apuntando a su padre (null = primer nivel). Aquí se arma el árbol en memoria.
//
// PESOS ABSOLUTOS: el peso de cada nodo es % del CURSO ENTERO (no de su padre).
//   - Los nodos de primer nivel suman 100.
//   - Los hijos de un grupo suman el peso del grupo (Continua 70% -> PCs 28% + Tareas 42%).
//   - Excepción: en un grupo con reparto 'iguales', los hijos se reparten el peso del grupo
//     en partes iguales; su columna "peso" se ignora (se calcula, no se guarda).

// Margen para errores de redondeo al comparar sumas de pesos (33.33 + 33.33 + 33.34...).
export const TOLERANCIA_PESO = 0.01

// Filas planas -> lista de nodos de primer nivel, cada uno con su lista "hijos" (recursiva).
export function construirArbol(filas) {
  const nodos = new Map(filas.map((f) => [f.id, { ...f, hijos: [] }]))
  const raices = []

  for (const nodo of nodos.values()) {
    const padre = nodo.parent_id ? nodos.get(nodo.parent_id) : null
    if (padre) padre.hijos.push(nodo)
    else raices.push(nodo)
  }

  const ordenar = (lista) => {
    lista.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    lista.forEach((n) => ordenar(n.hijos))
  }
  ordenar(raices)
  return raices
}

// ¿Este grupo reparte su peso en partes iguales entre sus hijos?
export function esIguales(nodo) {
  return nodo?.reparto === 'iguales' && nodo.hijos.length > 0
}

// Cuántas notas se descartan en un grupo 'iguales': lo guardado, pero nunca más de
// (hijos - 1), así siempre cuenta al menos una. Se ajusta solo si cambia la cantidad de hijos.
export function descartesEfectivos(nodo) {
  if (!esIguales(nodo)) return 0
  const guardado = Math.floor(Number(nodo.descartar_peores) || 0)
  return Math.min(Math.max(0, guardado), nodo.hijos.length - 1)
}

// Peso efectivo (% del curso) de cada nodo: Map id -> número.
//   - manual: el peso guardado
//   - hijo de un grupo 'iguales' con n hijos y N descartes: peso del grupo / (n - N)
//     (es lo que vale cada una de las notas que cuentan)
export function pesosEfectivos(arbol) {
  const pesos = new Map()
  const visitar = (nodos, padre) => {
    const iguales = esIguales(padre)
    const cuentan = iguales ? nodos.length - descartesEfectivos(padre) : 0
    for (const n of nodos) {
      pesos.set(n.id, iguales ? pesos.get(padre.id) / cuentan : Number(n.peso))
      visitar(n.hijos, n)
    }
  }
  visitar(arbol, null)
  return pesos
}

// Suma de los pesos guardados de un nivel (redondeada a 2 decimales para evitar 99.99999999).
export function sumaPesos(nodos) {
  const suma = nodos.reduce((total, n) => total + Number(n.peso), 0)
  return Math.round(suma * 100) / 100
}

// Revisa un nivel (los hijos de "padre", o el primer nivel si padre es null).
// Devuelve null si está bien (o si no aplica), o { suma, objetivo, diferencia }:
//   diferencia > 0 -> faltan ; diferencia < 0 -> sobran
export function revisarNivel(nodos, padre, pesos) {
  if (nodos.length === 0 || esIguales(padre)) return null // en 'iguales' se calculan solos
  const objetivo = padre ? pesos.get(padre.id) : 100
  const suma = sumaPesos(nodos)
  const diferencia = objetivo - suma
  return Math.abs(diferencia) < TOLERANCIA_PESO ? null : { suma, objetivo, diferencia }
}

// ¿Todos los niveles del árbol tienen pesos correctos?
export function arbolCompleto(arbol, pesos = pesosEfectivos(arbol)) {
  const revisar = (nodos, padre) =>
    revisarNivel(nodos, padre, pesos) === null && nodos.every((n) => revisar(n.hijos, n))
  return revisar(arbol, null)
}

// Ids de todos los descendientes de un nodo (hijos, nietos...), sin incluir el propio nodo.
export function idsDescendientes(filas, id) {
  const resultado = []
  const pendientes = [id]
  while (pendientes.length > 0) {
    const actual = pendientes.pop()
    for (const f of filas) {
      if (f.parent_id === actual) {
        resultado.push(f.id)
        pendientes.push(f.id)
      }
    }
  }
  return resultado
}

// 33.3 -> '33.3' ; 30 -> '30' ; 33.333 -> '33.33'
export function formatearNumero(n) {
  return String(Number(Number(n).toFixed(2)))
}
