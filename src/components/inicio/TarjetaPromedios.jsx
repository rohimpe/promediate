import { Link } from 'react-router'
import { MAX_ITEMS } from '../../lib/inicio'
import NotaFinal from '../NotaFinal'
import EstadoVacio from './EstadoVacio'
import TarjetaInicio from './TarjetaInicio'

// La nota final de cada curso, con los mismos colores que en Promedios (verde / rojo / neutro).
//   cursos: los de useCursosConNotas() ({ id, nombre, color, resultado })
export default function TarjetaPromedios({ cursos, cargando, error }) {
  const visibles = cursos.slice(0, MAX_ITEMS)

  let contenido
  if (cargando) {
    contenido = <p className="text-gray-600 dark:text-gray-400">Cargando…</p>
  } else if (error) {
    contenido = (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    )
  } else if (cursos.length === 0) {
    contenido = <EstadoVacio mensaje="Agrega tu primer curso" textoBoton="Ir a Promedios" to="/promedios" />
  } else {
    contenido = (
      <>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {visibles.map((c) => (
            <li key={c.id}>
              <Link
                to={`/promedios/${c.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:underline"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="size-3 shrink-0 rounded-full bg-gray-400"
                    style={c.color ? { backgroundColor: c.color } : undefined}
                  />
                  <span className="font-medium break-words">{c.nombre}</span>
                </span>
                {c.resultado ? (
                  <span className="shrink-0">
                    <NotaFinal resultado={c.resultado} className="text-lg" />
                    <span className="text-sm text-gray-600 dark:text-gray-400"> / 20</span>
                  </span>
                ) : (
                  <span className="shrink-0 text-sm text-gray-600 dark:text-gray-400">Sin evaluaciones</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {cursos.length > MAX_ITEMS && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            y {cursos.length - MAX_ITEMS} más en “Ver todo”
          </p>
        )}
      </>
    )
  }

  return (
    <TarjetaInicio titulo="Promedios" verTodo="/promedios">
      {contenido}
    </TarjetaInicio>
  )
}
