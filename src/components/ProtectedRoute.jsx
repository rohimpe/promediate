import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Cargando from './Cargando'

// Envuelve las rutas privadas: sin sesión, redirige a /login.
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Cargando />
  if (!user) return <Navigate to="/login" replace state={{ desde: location }} />

  return <Outlet />
}
