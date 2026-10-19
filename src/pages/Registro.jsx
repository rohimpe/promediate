import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { mensajeDeError } from '../lib/authErrors'
import AuthLayout from '../components/AuthLayout'
import CampoTexto from '../components/CampoTexto'

export default function Registro() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [revisarCorreo, setRevisarCorreo] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // "data" se guarda en el usuario; el trigger handle_new_user lo usa para crear el perfil.
      options: { data: { nombre: nombre.trim() } },
    })

    if (error) {
      setError(mensajeDeError(error))
    } else if (!data.session) {
      // Si en Supabase está activada la confirmación por correo, aún no hay sesión.
      setRevisarCorreo(true)
    }
    // Si hay sesión, PublicRoute redirige al inicio automáticamente.
    setEnviando(false)
  }

  if (revisarCorreo) {
    return (
      <AuthLayout titulo="Revisa tu correo" subtitulo={`Enviamos un enlace de confirmación a ${email}.`}>
        <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Volver a iniciar sesión
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Crear cuenta" subtitulo="Regístrate con tu correo.">
      <form onSubmit={onSubmit} className="space-y-4">
        <CampoTexto
          id="nombre"
          label="Nombre"
          type="text"
          autoComplete="name"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
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
          label="Contraseña (mínimo 6 caracteres)"
          type="password"
          autoComplete="new-password"
          minLength={6}
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
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
