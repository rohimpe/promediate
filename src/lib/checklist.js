import { fechaEnLima, hoyEnLima, instanteLima } from './fechas'
import { diasRestantes, ordenarPorPrioridad } from './priority'

// Reparte los pendientes del usuario en las listas del checklist.
// Nada de esto se guarda: se calcula cada vez, comparando con "hoy" en Lima.
//
//   vencidas:      pendientes cuyo día ya pasó (sin completar ni justificar)
//   hoyPendientes: pendientes que vencen / ocurren hoy
//   hechas:        completadas o justificadas de hoy, más las que el usuario acaba
//                  de cerrar en esta sesión (para poder deshacerlo)
//
// "cerradas" es un Set de ids cerrados en esta sesión; es opcional.
export function dividirChecklist(tareas, hoy = hoyEnLima(), cerradas = new Set()) {
  const vencidas = []
  const hoyPendientes = []
  const hechas = []

  for (const t of tareas) {
    const dias = diasRestantes(t, hoy)

    if (t.estado === 'pendiente') {
      if (dias === null) continue // sin fecha: no pertenece al checklist
      if (dias < 0) vencidas.push(t)
      else if (dias === 0) hoyPendientes.push(t)
    } else if (dias === 0 || cerradas.has(t.id)) {
      hechas.push(t)
    }
  }

  return {
    vencidas: ordenarPorPrioridad(vencidas),
    hoyPendientes: ordenarPorPrioridad(hoyPendientes),
    hechas: ordenarPorPrioridad(hechas),
  }
}

// Une en UNA sola lista lo de hoy: pendientes de la app (`tareas`, ya ordenados por prioridad) y eventos de Google
// (items de lib/seguimiento.js). Cada fila es { id, origen: 'app' | 'google', tarea | evento }.
// Orden:
//   1. las entregas, tal como llegan (por prioridad calculada)
//   2. lo que no tiene hora (eventos de todo el día y actividades sin hora)
//   3. lo que tiene hora (actividades y eventos de Google), cronológico
// En 2 y 3 se ordena por día primero, para que las "hechas" de otro día no se mezclen con las de hoy.
export function unirListaHoy(tareas, eventosGoogle = []) {
  const entregas = []
  const conTiempo = []

  for (const t of tareas) {
    if (t.tipo === 'tarea') {
      entregas.push({ id: t.id, origen: 'app', tarea: t })
      continue
    }
    const conHora = !!(t.fecha_actividad && t.hora_inicio)
    conTiempo.push({
      id: t.id,
      origen: 'app',
      tarea: t,
      titulo: t.titulo,
      todoElDia: !conHora,
      inicio: instanteLima(t.fecha_actividad ?? hoyEnLima(), conHora ? t.hora_inicio : '00:00'),
    })
  }

  for (const e of eventosGoogle) {
    conTiempo.push({ id: e.id, origen: 'google', evento: e, titulo: e.titulo, todoElDia: e.todoElDia, inicio: e.inicio })
  }

  conTiempo.sort(
    (a, b) =>
      fechaEnLima(a.inicio).localeCompare(fechaEnLima(b.inicio)) ||
      Number(b.todoElDia) - Number(a.todoElDia) ||
      a.inicio - b.inicio ||
      a.titulo.localeCompare(b.titulo, 'es'),
  )

  return [...entregas, ...conTiempo]
}

// --- Campos que se guardan en Supabase al cambiar el estado de un pendiente ---

export function camposCompletada() {
  return { estado: 'completada', completed_at: new Date().toISOString(), justificacion: null }
}

// El motivo es obligatorio (la base de datos también lo exige con un CHECK).
export function camposJustificada(motivo) {
  return { estado: 'justificada', justificacion: motivo, completed_at: null }
}

// Deshacer: vuelve a dejarlo como pendiente.
export function camposPendiente() {
  return { estado: 'pendiente', justificacion: null, completed_at: null }
}
