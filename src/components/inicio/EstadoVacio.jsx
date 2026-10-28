import { Link } from 'react-router'

// Mensaje amistoso cuando una tarjeta no tiene nada, con un botón que lleva a crear lo que falta.
export default function EstadoVacio({ mensaje, textoBoton, to }) {
  return (
    <div className="py-4 text-center">
      <p className="text-gray-600 dark:text-gray-400">{mensaje}</p>
      <Link
        to={to}
        className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {textoBoton}
      </Link>
    </div>
  )
}
