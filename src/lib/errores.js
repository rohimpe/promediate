// Los errores de Supabase traen más información de la que se ve en pantalla.
// Se muestran completos en la consola (F12) para poder depurar; al usuario le seguimos
// mostrando mensajes genéricos. Uso:  if (error) throw registrarError(error)
export function registrarError(error) {
  const { message, details, hint, code } = error
  console.error('Error de Supabase:', { message, details, hint, code })
  return error
}
