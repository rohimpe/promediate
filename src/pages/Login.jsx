import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { mensajeDeError } from '../lib/authErrors'
import AuthLayout from '../components/AuthLayout'
import CampoTexto from '../components/CampoTexto'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    // Si sale bien no hace falta redirigir: PublicRoute detecta la sesión y manda al inicio.
    if (error) setError(mensajeDeError(error))
    setEnviando(false)
  }

  return (
    <AuthLayout titulo="Iniciar sesión" subtitulo="Entra para ver tu tablero.">
      <form onSubmit={onSubmit} className="space-y-4">
        <CampoTexto
          id="email"
          label="Correo"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoTexto
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Regístrate
        </Link>
      </p>
    </AuthLayout>
  )
}
