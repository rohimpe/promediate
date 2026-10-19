import { Outlet } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

// Estructura de las páginas privadas: barra superior con el botón de cerrar sesión.
export default function AppLayout() {
  const { user } = useAuth()

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
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
