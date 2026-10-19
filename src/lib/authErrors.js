// Traduce los mensajes de error de Supabase Auth (vienen en inglés) a español.
export function mensajeDeError(error) {
  const msg = (error?.message ?? '').toLowerCase()

  if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.'
  if (msg.includes('user already registered')) return 'Ya existe una cuenta con ese correo.'
  if (msg.includes('password should be at least')) return 'La contraseña es muy corta (mínimo 6 caracteres).'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo otra vez.'
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'No hay conexión con el servidor.'

  return 'Ocurrió un error. Inténtalo de nuevo.'
}
