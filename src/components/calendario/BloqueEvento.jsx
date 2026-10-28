import { COLOR_JUSTIFICADA } from '../../lib/calendario'
import { horaEnLima } from '../../lib/fechas'

// Un evento dibujado como botón. Se ve distinto según tipo y estado:
//   actividad  -> bloque con franja de color a la izquierda
//   entrega    -> marcador con borde de color (y ⚑) en su hora límite
//   completada -> ✓ y texto tachado   · justificada -> gris con etiqueta
//   vencida    -> borde rojo           · pendiente  -> normal
//
// "detalle": si hay alto suficiente, agrega una segunda línea con la hora.
// La posición (absolute, top…) la decide quien lo usa, con className y style.
export default function BloqueEvento({ evento, detalle = false, onClick, className = '', style }) {
  const { estado, tipo } = evento
  const color = estado === 'justificada' ? COLOR_JUSTIFICADA : evento.color
  const hecha = estado === 'completada'

  const hora =
    tipo === 'actividad' && !evento.todoElDia
      ? `${horaEnLima(evento.inicio)}–${horaEnLima(evento.fin)}`
      : tipo === 'entrega'
        ? `Límite ${horaEnLima(evento.inicio)}`
        : ''

  const apariencia =
    tipo === 'entrega'
      ? {
          border: `2px solid ${color}`,
          backgroundColor: `color-mix(in srgb, ${color} 12%, var(--fondo-bloque))`,
        }
      : {
          borderLeft: `4px solid ${color}`,
          backgroundColor: `color-mix(in srgb, ${color} 25%, var(--fondo-bloque))`,
        }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${evento.titulo}${hora ? ` · ${hora}` : ''}${evento.curso ? ` · ${evento.curso}` : ''}`}
      style={{ ...apariencia, ...style }}
      className={`block overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight [--fondo-bloque:#fff] dark:[--fondo-bloque:#030712] ${
        estado === 'vencida' ? 'ring-2 ring-red-500' : ''
      } ${hecha || estado === 'justificada' ? 'opacity-70' : ''} ${className}`}
    >
      <span className="flex items-center gap-1">
        {tipo === 'entrega' && !hecha && <span aria-hidden>⚑</span>}
        {hecha && (
          <span aria-hidden className="font-bold text-green-600 dark:text-green-400">
            ✓
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate font-medium ${hecha ? 'line-through' : ''}`}>{evento.titulo}</span>
        {estado === 'justificada' && (
          <span className="shrink-0 rounded bg-gray-200 px-1 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            Justificada
          </span>
        )}
      </span>
      {detalle && hora && (
        <span className="block truncate text-gray-700 dark:text-gray-300">
          {hora}
          {evento.curso && ` · ${evento.curso}`}
        </span>
      )}
    </button>
  )
}
