import { NavLink } from 'react-router'

const ENLACES = [
  { to: '/', texto: 'Inicio', end: true },
  { to: '/hoy', texto: 'Hoy', end: true },
  { to: '/calendario', texto: 'Calendario', end: true },
  { to: '/tareas', texto: 'Pendientes', end: true },
  { to: '/tareas/nueva', texto: 'Nuevo pendiente', end: true },
  { to: '/promedios', texto: 'Promedios', end: false },
]

// En celular: barra fija abajo (fácil de alcanzar con el pulgar).
// En pantallas grandes (sm+): barra normal debajo del encabezado.
export default function BarraNavegacion() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white sm:static sm:border-t-0 sm:border-b dark:border-gray-800 dark:bg-gray-950"
    >
      <ul className="mx-auto flex max-w-3xl">
        {ENLACES.map(({ to, texto, end }) => (
          <li key={to} className="flex-1 sm:flex-none">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `block px-1 py-3 text-center text-xs leading-tight font-medium sm:px-4 sm:text-sm ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`
              }
            >
              {texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
