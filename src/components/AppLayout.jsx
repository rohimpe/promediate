import { Outlet, useLocation } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import BarraNavegacion from './BarraNavegacion'
import ResumenDelDia from './ResumenDelDia'

// Estructura de las páginas privadas: barra superior con el botón de cerrar sesión.
export default function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  async function cerrarSesion() {
    // Al cerrar sesión, onAuthStateChange avisa a AuthProvider y
    // ProtectedRoute redirige solo a /login.
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-semibold">Tablero de Vida</span>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-gray-600 sm:block dark:text-gray-400">
              {user?.email}
            </span>
            <button
              onClick={cerrarSesion}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <BarraNavegacion />
      <ResumenDelDia />
      {/* pb-20: deja espacio para que la barra fija de abajo (celular) no tape el contenido */}
      {/* El calendario necesita más ancho para que quepan los 7 días de la semana;
          Inicio lo comparte con tres tarjetas a su lado, así que es aún más ancha. */}
      <main
        className={`mx-auto p-4 pb-20 sm:pb-4 ${
          pathname === '/' ? 'max-w-6xl' : pathname === '/calendario' ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <Outlet />
      </main>
    </div>
  )
}
