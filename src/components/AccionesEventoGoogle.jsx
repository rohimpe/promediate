import { camposCompletada, camposJustificada } from '../lib/checklist'
import AccionesChecklist from './AccionesChecklist'

// Fui / Justificar / Deshacer de un evento de Google seguido. Son los mismos botones que los de un pendiente
// (AccionesChecklist), pero guardan en el seguimiento.
//   seguido:      un seguido (ver lib/seguimiento.js), guardado o virtual
//   seguimiento:  lo que devuelve useSeguimientoGoogle()
export default function AccionesSeguido({ seguido, seguimiento }) {
  return (
    // key: al cambiar de estado se vuelve a montar y los botones salen sin "ocupado"
    <AccionesChecklist
      key={seguido.estado}
      tarea={seguido}
      textoCompletar="✓ Fui"
      onCompletar={() => seguimiento.marcar(seguido, camposCompletada())}
      onJustificar={(motivo) => seguimiento.marcar(seguido, camposJustificada(motivo))}
      onDeshacer={() => seguimiento.deshacer(seguido)}
    />
  )
}
