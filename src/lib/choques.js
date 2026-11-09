import { fechaEnLima, formatearFechaHora, horaEnLima, instanteLima } from './fechas'
import { tareasAEventos } from './calendario'

// ---------------------------------------------------------------------
// Choques de horario. Funciones puras: no consultan nada, reciben los datos ya cargados.
//
// Un "elemento con hora" es un evento normalizado (ver calendario.js): una actividad de la app (tipo 'actividad')
// o un evento de Google (tipo 'evento'), con `inicio` y `fin` (Date) y sin `todoElDia`. Las entregas no se
// comparan: son una fecha límite, no ocupan tiempo.
//
// Dos intervalos se solapan si  inicio < fin_otro  y  fin > inicio_otro. Tocarse en el borde
// (uno termina a las 10:00 y el otro empieza a las 10:00) NO cuenta.
// ---------------------------------------------------------------------

// ¿Este elemento entra en las comparaciones? Actividades y eventos de Google con hora; nada más.
export function esElementoConHora(e) {
  return !e.todoElDia && (e.tipo === 'actividad' || e.tipo === 'evento')
}

function seSolapan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && finA > inicioB
}

// Los elementos de `elementos` que se solapan con el intervalo { inicio, fin } (Date).
//   excluirId:       id del elemento que se está editando (para no chocar consigo mismo)
//   excluirGoogleId: id en Google del evento que es la copia de ESE mismo pendiente (tasks.google_event_id).
//                    También se descartan los eventos marcados como creados por la app (`creadoPorApp`,
//                    extendedProperties.private.origen = 'tablero-de-vida'), por si alguna vez llegan hasta aquí.
// Devuelve los elementos ordenados por hora de inicio.
export function buscarChoques({ inicio, fin }, elementos, { excluirId = null, excluirGoogleId = null } = {}) {
  return elementos
    .filter((e) => {
      if (!esElementoConHora(e)) return false
      if (excluirId !== null && e.id === excluirId) return false
      if (e.creadoPorApp) return false
      if (excluirGoogleId && e.googleId === excluirGoogleId) return false
      return seSolapan(inicio, fin, e.inicio, e.fin)
    })
    .sort((a, b) => a.inicio - b.inicio)
}

// Ids de los elementos que se solapan con OTRO de la lista (para marcarlos en el calendario).
export function idsConChoque(elementos) {
  const lista = elementos.filter(esElementoConHora).sort((a, b) => a.inicio - b.inicio)
  const ids = new Set()
  for (let i = 0; i < lista.length; i++) {
    // Ordenados por inicio: en cuanto uno empieza después de que termina `lista[i]`, ninguno más lo toca.
    for (let j = i + 1; j < lista.length && lista[j].inicio < lista[i].fin; j++) {
      if (seSolapan(lista[i].inicio, lista[i].fin, lista[j].inicio, lista[j].fin)) {
        ids.add(lista[i].id)
        ids.add(lista[j].id)
      }
    }
  }
  return ids
}

// Intervalo de una actividad del formulario: ('2026-11-10', '10:00', '11:30') -> { inicio, fin } (Date, hora de Lima).
export function intervaloDeActividad(fecha, horaInicio, horaFin) {
  return { inicio: instanteLima(fecha, horaInicio), fin: instanteLima(fecha, horaFin) }
}

// Las actividades con hora de la app (filas de `tasks`) como elementos con hora.
export function actividadesAElementos(filas) {
  return tareasAEventos(filas.filter((t) => t.tipo === 'actividad')).filter(esElementoConHora)
}

// '10:00–11:30' (hora de Lima); si termina otro día, muestra la fecha de fin: '22:00 → 11 nov, 01:00'.
export function horarioDeElemento(e) {
  if (fechaEnLima(e.inicio) !== fechaEnLima(e.fin)) return `${horaEnLima(e.inicio)} → ${formatearFechaHora(e.fin)}`
  return `${horaEnLima(e.inicio)}–${horaEnLima(e.fin)}`
}
