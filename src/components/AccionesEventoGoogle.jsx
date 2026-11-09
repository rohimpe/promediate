import { camposCompletada, camposJustificada } from '../lib/checklist'
import AccionesChecklist from './AccionesChecklist'

// Fui / Justificar / Deshacer de un evento de Google que es pendiente. Son los mismos botones que los de un
// pendiente (AccionesChecklist), pero guardan en google_seguimiento.
//   evento:       un item de lib/seguimiento.js, guardado o virtual
//   seguimiento:  lo que devuelve useSeguimientoGoogle()
export default function AccionesEventoGoogle({ evento, seguimiento }) {
  return (
    // key: al cambiar de estado se vuelve a montar y los botones salen sin "ocupado"
    <AccionesChecklist
      key={evento.estado}
      tarea={evento}
      textoCompletar="✓ Fui"
      onCompletar={() => seguimiento.marcar(evento, camposCompletada())}
      onJustificar={(motivo) => seguimiento.marcar(evento, camposJustificada(motivo))}
      onDeshacer={() => seguimiento.deshacer(evento)}
    />
  )
}
