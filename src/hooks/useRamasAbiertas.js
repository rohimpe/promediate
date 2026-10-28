import { useState } from 'react'

const clave = (cursoId) => `promedios-ramas-abiertas-${cursoId}`

// Lee del navegador la lista de ramas abiertas de un curso. Si localStorage no está
// disponible (modo privado, bloqueado...) o los datos están dañados, empieza todo cerrado.
function leer(cursoId) {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave(cursoId)))
    return new Set(Array.isArray(guardado) ? guardado : [])
  } catch {
    return new Set()
  }
}

function guardar(cursoId, abiertas) {
  try {
    localStorage.setItem(clave(cursoId), JSON.stringify([...abiertas]))
  } catch {
    // Si no se puede guardar, la app funciona igual; solo no recordará las ramas abiertas.
  }
}

// Recuerda qué ramas del árbol de un curso están abiertas (se guarda en este navegador).
//   const ramas = useRamasAbiertas(cursoId)
//   ramas.estaAbierta(id) · ramas.alternar(id) · ramas.abrir(id)
export function useRamasAbiertas(cursoId) {
  const [abiertas, setAbiertas] = useState(() => leer(cursoId))

  function cambiar(modificar) {
    setAbiertas((actuales) => {
      const nuevas = new Set(actuales)
      modificar(nuevas)
      guardar(cursoId, nuevas)
      return nuevas
    })
  }

  return {
    estaAbierta: (id) => abiertas.has(id),
    alternar: (id) => cambiar((s) => (s.has(id) ? s.delete(id) : s.add(id))),
    abrir: (id) => cambiar((s) => s.add(id)),
  }
}
