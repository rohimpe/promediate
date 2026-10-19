import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Cargando from './Cargando'

// Para /login y /registro: si ya hay sesión, manda al inicio.
export default function PublicRoute() {
  const { user, loading } = useAuth()

  if (loading) return <Cargando />
  if (user) return <Navigate to="/" replace />

  return <Outlet />
}
