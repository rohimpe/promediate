import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from './useAuth'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // loading = true mientras Supabase revisa si ya había una sesión guardada.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Al abrir la app, recuperar la sesión guardada en el navegador (si hay).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 2. Escuchar cambios: login, logout, refresco de token, otras pestañas...
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = { session, user: session?.user ?? null, loading }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
