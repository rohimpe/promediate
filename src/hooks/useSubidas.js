import { useCallback, useEffect, useRef, useState } from 'react'
import { ESTADOS_SIN_GOOGLE, MENSAJES_ARCHIVO } from '../lib/archivos'
import { subirArchivo } from '../lib/archivosApi'
import { recargarConexionGoogle, useConexionGoogle } from './useConexionGoogle'

// ¿Se puede usar Drive? Junta lo que se sabe de la conexión (useConexionGoogle) con lo último que respondió una
// función de Drive (p. ej. 'permisos_incompletos', que solo se sabe al intentarlo).
//   const { cargando, estadoGoogle, bloquear } = useEstadoDrive()
//   estadoGoogle: null si se puede usar, o 'no_conectado' | 'reconectar' | 'permisos_incompletos'
//   bloquear(estado): avisar el estado que devolvió una función (ignora los que no son de conexión)
export function useEstadoDrive() {
  const google = useConexionGoogle()
  const [bloqueo, setBloqueo] = useState(null)

  const bloquear = useCallback((estado) => {
    if (!ESTADOS_SIN_GOOGLE.includes(estado)) return
    setBloqueo(estado)
    if (estado === 'reconectar') recargarConexionGoogle() // el resto de la app también debe enterarse
  }, [])

  let estadoGoogle = bloqueo
  if (!estadoGoogle && !google.cargando && !google.conectado) {
    estadoGoogle = google.reconectar ? 'reconectar' : 'no_conectado'
  }
  return { cargando: google.cargando, estadoGoogle, bloquear }
}

// Cola de subidas a Drive con el progreso de cada archivo. Se suben de UNO EN UNO: así la primera subida crea las
// carpetas y las siguientes las reutilizan (en paralelo podrían crear carpetas duplicadas).
//   const { subidas, agregar, limpiar } = useSubidas({ onSubido, onFallo })
//   agregar(archivos, { cursoId, carpetaId?, tareaId? }): archivos es un FileList o un array de File
//   subidas: [{ clave, nombre, progreso (0 a 1), estado: 'espera' | 'subiendo' | 'registrando' | 'listo' | 'error', error }]
//   onSubido(fila): cada archivo que quedó registrado (la fila de `archivos`)
//   onFallo(estado): cada archivo que falló, con el estado ('demasiado_grande', 'reconectar'…)
export function useSubidas({ onSubido, onFallo } = {}) {
  const [subidas, setSubidas] = useState([])
  const cola = useRef(Promise.resolve())
  const montado = useRef(true)
  // Las funciones más recientes de quien usa el hook, sin reiniciar la cola cuando cambian.
  const avisos = useRef({ onSubido, onFallo })
  useEffect(() => {
    avisos.current = { onSubido, onFallo }
  })
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const actualizar = useCallback((clave, campos) => {
    if (!montado.current) return
    setSubidas((actuales) => actuales.map((s) => (s.clave === clave ? { ...s, ...campos } : s)))
  }, [])

  const agregar = useCallback(
    (archivos, destino) => {
      const nuevas = [...archivos].map((archivo) => ({ clave: crypto.randomUUID(), archivo }))
      setSubidas((actuales) => [
        ...actuales,
        ...nuevas.map(({ clave, archivo }) => ({ clave, nombre: archivo.name, progreso: 0, estado: 'espera', error: '' })),
      ])

      for (const { clave, archivo } of nuevas) {
        cola.current = cola.current.then(async () => {
          actualizar(clave, { estado: 'subiendo' })
          const r = await subirArchivo(archivo, destino, (progreso) =>
            actualizar(clave, { progreso, estado: progreso >= 1 ? 'registrando' : 'subiendo' }),
          )
          if (r.estado === 'ok') {
            actualizar(clave, { estado: 'listo', progreso: 1 })
            if (montado.current) avisos.current.onSubido?.(r.archivo)
          } else {
            actualizar(clave, { estado: 'error', error: MENSAJES_ARCHIVO[r.estado] ?? MENSAJES_ARCHIVO.error })
            if (montado.current) avisos.current.onFallo?.(r.estado)
          }
        })
      }
    },
    [actualizar],
  )

  // Quita de la lista las subidas que ya terminaron (bien o mal).
  const limpiar = useCallback(() => {
    setSubidas((actuales) => actuales.filter((s) => s.estado !== 'listo' && s.estado !== 'error'))
  }, [])

  return { subidas, agregar, limpiar }
}
