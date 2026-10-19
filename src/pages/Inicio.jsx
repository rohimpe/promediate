import { useAuth } from '../hooks/useAuth'

// Página provisional: más adelante mostrará los promedios y el resumen del día.
export default function Inicio() {
  const { user } = useAuth()
  const nombre = user?.user_metadata?.nombre || user?.email

  return (
    <>
      <h1 className="text-2xl font-bold">Hola, {nombre} 👋</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Sesión iniciada correctamente.</p>
    </>
  )
}
