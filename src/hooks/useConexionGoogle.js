import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { obtenerConexionGoogle } from '../lib/googleApi'
import { guardarSincronizarGoogle, obtenerSincronizarGoogle } from '../lib/profileApi'
import { useAuth } from './useAuth'

// Lo que se sabe de la conexión con Google, compartido por todos los componentes (está fuera del hook):
// el formulario, cada tarjeta de pendiente y Conexiones lo leen sin repetir la consulta.
//   datos: { userId, conectado, email, sincronizar } o null si aún no se cargó
let datos = null
let cargandoPara = null
const oyentes = new Set()

function publicar(nuevo) {
  datos = nuevo
  oyentes.forEach((avisar) => avisar())
}

function suscribir(avisar) {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

const leer = () => datos

async function cargar(userId) {
  if (cargandoPara === userId) return // ya hay una consulta en curso
  cargandoPara = userId
  try {
    const conexion = await obtenerConexionGoogle()
    // 'reconectar' cuenta como no conectado: Google no aceptaría la llamada.
    const conectado = !!conexion.conectado && conexion.estado === 'activa'
    const reconectar = !!conexion.conectado && conexion.estado === 'reconectar'
    const sincronizar = conectado ? await obtenerSincronizarGoogle(userId) : false
    publicar({ userId, conectado, reconectar, email: conexion.email_google ?? null, sincronizar })
  } catch {
    // Si no se puede saber, se actúa como si no estuviera conectado: sin interruptor ni avisos.
    publicar({ userId, conectado: false, reconectar: false, email: null, sincronizar: false })
  } finally {
    cargandoPara = null
  }
}

// Vuelve a consultar (p. ej. después de desconectar Google en Conexiones).
export function recargarConexionGoogle() {
  const userId = datos?.userId
  publicar(null)
  if (userId) cargar(userId)
}

// ¿Google está conectado y listo para crear eventos?
//   const { cargando, conectado, reconectar, email, sincronizar, cambiarSincronizar } = useConexionGoogle()
//   reconectar: hay conexión guardada pero Google la rechazó (conectado es false)
//   sincronizar: profiles.google_sincronizar ("Crear eventos en Google automáticamente")
export function useConexionGoogle() {
  const { user } = useAuth()
  const userId = user?.id
  const actual = useSyncExternalStore(suscribir, leer)
  const vigente = actual && actual.userId === userId ? actual : null

  useEffect(() => {
    if (userId && !vigente) cargar(userId)
  }, [userId, vigente])

  const cambiarSincronizar = useCallback(
    async (valor) => {
      await guardarSincronizarGoogle(userId, valor)
      if (datos?.userId === userId) publicar({ ...datos, sincronizar: valor })
    },
    [userId],
  )

  return {
    cargando: !vigente,
    conectado: !!vigente?.conectado,
    reconectar: !!vigente?.reconectar,
    email: vigente?.email ?? null,
    sincronizar: !!vigente?.sincronizar,
    cambiarSincronizar,
  }
}
