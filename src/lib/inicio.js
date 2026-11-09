import { construirArbol } from './arbol'
import { dividirChecklist, unirListaHoy } from './checklist'
import { calcularCurso } from './grades'
import { eventosDeHoy } from './seguimiento'

// Funciones puras que preparan los datos de las tarjetas de Inicio.
// Reciben los datos ya cargados (una sola consulta compartida) y no guardan nada.

// Cuántos elementos muestra como máximo cada tarjeta.
export const MAX_ITEMS = 4

// Nombre para el saludo: el del perfil; si no tiene, la parte del correo antes de la @.
export function nombreParaSaludo(nombrePerfil, email) {
  return nombrePerfil?.trim() || email?.split('@')[0] || ''
}

// Lo de hoy, todo junto (pendientes, actividades y eventos de Google que entran a pendientes: usePendientesGoogle):
//   pendientes:    filas por hacer, en una sola lista y en este orden (ver unirListaHoy): entregas por prioridad
//                  calculada; luego lo de todo el día; luego lo que tiene hora, cronológico
//   hechas, total: cuántos se completaron o justificaron hoy y cuántos hay en total ("X de Y completados")
//   actividadesVencidas: actividades de días anteriores sin cerrar (las entregas vencidas
//                  se ven en "Próximas entregas"). Los eventos de Google sin marcar de días anteriores NO suman.
export function resumenDeHoy(tareas, hoy, eventosGoogle = []) {
  const { hoyPendientes, hechas, vencidas } = dividirChecklist(tareas, hoy)
  const eventos = eventosDeHoy(eventosGoogle, hoy)
  return {
    pendientes: unirListaHoy(hoyPendientes, eventos.pendientes),
    hechas: hechas.length + eventos.hechas,
    total: hoyPendientes.length + hechas.length + eventos.total,
    actividadesVencidas: vencidas.filter((t) => t.tipo === 'actividad').length,
  }
}

// Entregas pendientes con fecha límite, de la más antigua a la más próxima:
// así las vencidas sin completar quedan primero.
export function entregasPendientes(tareas) {
  return tareas
    .filter((t) => t.tipo === 'tarea' && t.estado === 'pendiente' && t.fecha_entrega)
    .sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega))
}

// Cursos (con sus evaluaciones anidadas) -> cursos con su resultado de calcularCurso().
// resultado es null si el curso todavía no tiene evaluaciones.
export function cursosConResultado(cursos) {
  return cursos.map(({ evaluations, ...curso }) => ({
    ...curso,
    resultado: evaluations.length > 0 ? calcularCurso(construirArbol(evaluations)) : null,
  }))
}
