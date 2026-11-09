import { construirArbol } from './arbol'
import { dividirChecklist } from './checklist'
import { calcularCurso } from './grades'
import { seguidosDeHoy } from './seguimiento'

// Funciones puras que preparan los datos de las tarjetas de Inicio.
// Reciben los datos ya cargados (una sola consulta compartida) y no guardan nada.

// Cuántos elementos muestra como máximo cada tarjeta.
export const MAX_ITEMS = 4

// Nombre para el saludo: el del perfil; si no tiene, la parte del correo antes de la @.
export function nombreParaSaludo(nombrePerfil, email) {
  return nombrePerfil?.trim() || email?.split('@')[0] || ''
}

// Lo de hoy: primero los eventos de Google que sigue el usuario (todo el día y luego por hora)
// y después los pendientes por prioridad calculada.
//   pendientes:    por hacer hoy (pendientes de la app y seguidos de Google; los de Google traen origen: 'google')
//   hechas:        cuántos se completaron o justificaron hoy (incluye los seguidos de Google)
//   actividadesVencidas: actividades de días anteriores sin cerrar (las entregas vencidas
//                  se ven en "Próximas entregas")
//   seguidos:      los seguidos de Google (useSeguidosGoogle), opcional
export function resumenDeHoy(tareas, hoy, seguidos = []) {
  const { hoyPendientes, hechas, vencidas } = dividirChecklist(tareas, hoy)
  const google = seguidosDeHoy(seguidos, hoy)
  return {
    pendientes: [...google.pendientes, ...hoyPendientes],
    hechas: hechas.length + google.hechas.length,
    total: hoyPendientes.length + hechas.length + google.pendientes.length + google.hechas.length,
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
