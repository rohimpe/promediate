const ESTILOS = {
  alta: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  media: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  baja: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

// Etiqueta de color: alta (roja), media (ámbar), baja (verde).
export default function EtiquetaPrioridad({ prioridad }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTILOS[prioridad]}`}>
      {prioridad}
    </span>
  )
}
