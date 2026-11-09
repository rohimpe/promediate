import { IconoGoogle } from './calendario/BloqueEvento'

const BASE = { viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }

// Bandera: una entrega (algo con fecha límite). Es el mismo ⚑ que usa el calendario.
export function IconoEntrega({ className = 'size-3.5' }) {
  return (
    <svg {...BASE} className={`shrink-0 ${className}`}>
      <path d="M3.5 14V2.5M3.5 3h8l-2 2.75 2 2.75h-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Reloj: una actividad (algo personal con horario).
export function IconoActividad({ className = 'size-3.5' }) {
  return (
    <svg {...BASE} className={`shrink-0 ${className}`}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Ícono de una fila de Hoy según su origen: Google, entrega o actividad.
//   fila: { origen: 'app' | 'google', tarea? } (ver unirListaHoy)
export default function IconoFila({ fila, className = 'size-3.5 text-gray-500 dark:text-gray-400' }) {
  if (fila.origen === 'google') return <IconoGoogle className={className} />
  return fila.tarea.tipo === 'tarea' ? <IconoEntrega className={className} /> : <IconoActividad className={className} />
}
