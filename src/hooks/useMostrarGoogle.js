import { useState } from 'react'

const CLAVE = 'calendario-mostrar-google'

// Lee la preferencia del navegador. Por defecto (o si localStorage no está disponible) se muestra.
function leer() {
  try {
    return localStorage.getItem(CLAVE) !== 'no'
  } catch {
    return true
  }
}

// Interruptor "Mostrar Google Calendar", recordado en este navegador.
//   const [mostrar, setMostrar] = useMostrarGoogle()
export function useMostrarGoogle() {
  const [mostrar, setMostrar] = useState(leer)

  function cambiar(valor) {
    setMostrar(valor)
    try {
      localStorage.setItem(CLAVE, valor ? 'si' : 'no')
    } catch {
      // Si no se puede guardar, funciona igual; solo no se recordará la elección.
    }
  }

  return [mostrar, cambiar]
}
