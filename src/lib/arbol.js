// El árbol de evaluaciones se guarda "plano" en la tabla evaluations: una fila por nodo,
// con parent_id apuntando a su padre (null = primer nivel). Aquí se arma el árbol en memoria.
//
// PESOS RELATIVOS AL PADRE: el peso de cada nodo es un % de su padre.
//   - Los hijos de cada nodo suman 100, y los de primer nivel también.
//     (Continua 70% -> PCs 40% + Tareas 30% + Proyecto 30%; PCs -> PC1 50% + PC2 50%.)
//   - El aporte real de un nodo al curso es su peso × el de todos sus ancestros / 100^nivel.
//     Ej.: PC1 = 50% de PCs, que es 40% de Continua, que es 70% del curso -> 14% del curso.
//   - Excepción: en un grupo con reparto 'iguales', cada hijo pesa 100 / (n - N) (n hijos,
//     N descartes); su columna "peso" se ignora (se calcula, no se guarda).

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

// Peso relativo (% de su padre) de cada nodo: Map id -> número.
//   - manual: el peso guardado
//   - hijo de un grupo 'iguales' con n hijos y N descartes: 100 / (n - N)
//     (es lo que vale cada una de las notas que cuentan)
export function pesosRelativos(arbol) {
  const pesos = new Map()
  const visitar = (nodos, padre) => {
    const iguales = esIguales(padre)
    const cuentan = iguales ? nodos.length - descartesEfectivos(padre) : 0
    for (const n of nodos) {
      pesos.set(n.id, iguales ? 100 / cuentan : Number(n.peso))
      visitar(n.hijos, n)
    }
  }
  visitar(arbol, null)
  return pesos
}

// Aporte real de cada nodo al curso (% del curso entero): Map id -> número.
// = peso relativo × aporte del padre / 100 (los de primer nivel aportan su propio peso).
export function aportesAlCurso(arbol, pesos = pesosRelativos(arbol)) {
  const aportes = new Map()
  const visitar = (nodos, aportePadre) => {
    for (const n of nodos) {
      const aporte = (pesos.get(n.id) * aportePadre) / 100
      aportes.set(n.id, aporte)
      visitar(n.hijos, aporte)
    }
  }
  visitar(arbol, 100)
  return aportes
}

// Suma de los pesos guardados de un nivel (redondeada a 2 decimales para evitar 99.99999999).
export function sumaPesos(nodos) {
  const suma = nodos.reduce((total, n) => total + Number(n.peso), 0)
  return Math.round(suma * 100) / 100
}

// Revisa un nivel (los hijos de "padre", o el primer nivel si padre es null): deben sumar 100.
// Devuelve null si está bien (o si no aplica), o { suma, diferencia }:
//   diferencia > 0 -> faltan ; diferencia < 0 -> sobran
export function revisarNivel(nodos, padre) {
  if (nodos.length === 0 || esIguales(padre)) return null // en 'iguales' se calculan solos
  const suma = sumaPesos(nodos)
  const diferencia = 100 - suma
  return Math.abs(diferencia) < TOLERANCIA_PESO ? null : { suma, diferencia }
}

// ¿Todos los niveles del árbol suman 100?
export function arbolCompleto(arbol) {
  const revisar = (nodos, padre) => revisarNivel(nodos, padre) === null && nodos.every((n) => revisar(n.hijos, n))
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
