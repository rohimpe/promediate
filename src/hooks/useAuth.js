import { createContext, useContext } from 'react'

// El contexto guarda { session, user, loading }. Lo llena AuthProvider.
export const AuthContext = createContext(null)

// Hook para leer la sesión desde cualquier componente:
//   const { user, loading } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
