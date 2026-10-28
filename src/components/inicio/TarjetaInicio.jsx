import { Link } from 'react-router'

// Marco común de las tarjetas de Inicio: título, enlace "Ver todo" y el contenido.
//   subtitulo: texto pequeño bajo el título (opcional)
export default function TarjetaInicio({ titulo, subtitulo, verTodo, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-sm text-gray-600 dark:text-gray-400">{subtitulo}</p>}
        </div>
        <Link
          to={verTodo}
          className="shrink-0 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Ver todo
        </Link>
      </div>
      {children}
    </section>
  )
}
