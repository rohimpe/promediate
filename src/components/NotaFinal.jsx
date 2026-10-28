import { formatearNota } from '../lib/grades'

const COLORES = {
  aprobado: 'text-green-700 dark:text-green-400', // nota final >= 10.5
  desaprobado: 'text-red-600 dark:text-red-400', // ni con 20 en lo que falta se llega a 10.5
  neutro: '', // todavía se puede aprobar: color normal del texto
}

// La nota final de un curso (puntos acumulados sobre 20) con su color.
// "resultado" es lo que devuelve calcularCurso() de lib/grades.js.
// Se usa igual en la página del curso, en la lista de cursos y en Inicio.
export default function NotaFinal({ resultado, className = '' }) {
  return (
    <span className={`font-semibold ${COLORES[resultado.estado]} ${className}`}>
      {formatearNota(resultado.notaFinal)}
    </span>
  )
}
