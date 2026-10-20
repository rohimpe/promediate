import { hoyEnLima } from './fechas'
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
