import { estaAprobado, formatearNota } from '../lib/grades'

// Muestra una nota con 2 decimales: verde si aprueba (>= 10.5) y rojo si desaprueba.
// Si todavía no hay nota (null), muestra "vacio" en gris.
export default function NotaColor({ valor, vacio = 'Sin notas', className = '' }) {
  if (valor == null) {
    return <span className={`text-gray-600 dark:text-gray-400 ${className}`}>{vacio}</span>
  }
  const color = estaAprobado(valor)
    ? 'text-green-700 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
  return <span className={`font-semibold ${color} ${className}`}>{formatearNota(valor)}</span>
}
