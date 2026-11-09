import { useCallback, useEffect, useState } from 'react'
import { googleAEventos, rangoAInstantes } from '../lib/calendario'
import { obtenerEventosGoogle } from '../lib/googleApi'
import { useAuth } from './useAuth'

// Lo ya pedido a Google se guarda 5 minutos. Pasado ese tiempo se vuelve a pedir.
const VIGENCIA = 5 * 60_000

// Caché en memoria (solo vive mientras la pestaña está abierta; se comparte entre Inicio y
// Calendario porque está fuera del hook). Cada entrada guarda el rango de días que cubre:
// si se pide un rango contenido en otro ya pedido (p. ej. un día dentro del mes que ya se cargó),
// se responde sin llamar a Google.
//   entrada: { desde, hasta, estado, eventos, truncado, pedidoEn }
let cache = { userId: null, entradas: [] }
const pendientes = new Map() // llamadas en curso, para no duplicarlas

const SIN_DATOS = { estado: null, eventos: [], truncado: false }

function buscarEnCache(userId, desde, hasta) {
  if (cache.userId !== userId) return null
  const ahora = Date.now()
  return cache.entradas.find((e) => ahora - e.pedidoEn < VIGENCIA && e.desde <= desde && e.hasta >= hasta) ?? null
}

function guardarEnCache(userId, entrada) {
  if (cache.userId !== userId) cache = { userId, entradas: [] }
  const ahora = Date.now()
  cache.entradas = [...cache.entradas.filter((e) => ahora - e.pedidoEn < VIGENCIA), entrada]
}

// Olvida todo lo pedido. Se llama al tocar "Actualizar" y al desconectar Google.
export function invalidarEventosGoogle() {
  cache = { userId: null, entradas: [] }
  pendientes.clear()
}

// Pide el rango a la Edge Function (o se une a la llamada que ya está en curso) y lo guarda.
function pedir(userId, desde, hasta) {
  const clave = `${userId}|${desde}|${hasta}`
  if (!pendientes.has(clave)) {
    const instantes = rangoAInstantes({ desde, hasta })
    const promesa = obtenerEventosGoogle(instantes.desde, instantes.hasta)
      .then((r) => {
        const ok = r.estado === 'ok'
        const entrada = {
          // Si Google no está disponible (no conectado, reconectar…) no depende del rango:
          // la entrada vale para cualquier rango y no se insiste en cada cambio de semana.
          desde: ok ? desde : '0000-01-01',
          hasta: ok ? hasta : '9999-12-31',
          estado: r.estado,
          eventos: ok ? googleAEventos(r.eventos) : [],
          truncado: r.truncado,
          pedidoEn: Date.now(),
        }
        guardarEnCache(userId, entrada)
        return entrada
      })
      .finally(() => pendientes.delete(clave))
    pendientes.set(clave, promesa)
  }
  return pendientes.get(clave)
}

// Eventos de Google Calendar para el rango de días visible en el calendario.
//   rango:  { desde, hasta } ('YYYY-MM-DD' de Lima, ambos incluidos) o null si aún no se sabe
//   activo: false para no llamar a Google (interruptor "Mostrar Google Calendar" apagado)
//   const { eventos, estado, truncado, cargando, error, actualizar } = useGoogleEventos(rango, activo)
//
// `estado` es 'ok', 'no_conectado', 'reconectar', 'permisos_incompletos' (o null si aún no hay respuesta).
// `eventos` ya están normalizados (origen 'google'). Se vuelve a pedir al tocar actualizar() y al
// volver a la pestaña si lo guardado tiene más de 5 minutos.
export function useGoogleEventos(rango, activo = true) {
  const { user } = useAuth()
  const userId = user?.id
  const desde = rango?.desde
  const hasta = rango?.hasta

  // Último resultado de una consulta. `clave` dice a qué consulta corresponde: mientras no coincida con la
  // actual, se está cargando (así "cargando" se deduce y no hace falta guardarlo con setState en el efecto).
  const [resultado, setResultado] = useState({ clave: null, entrada: SIN_DATOS, fallo: false })
  const [version, setVersion] = useState(0) // sube para forzar una nueva consulta
  const clave = activo && userId && desde ? `${userId}|${desde}|${hasta}|${version}` : null

  useEffect(() => {
    if (!clave) return
    // Si ya está en la caché se responde igual, solo que sin llamar a Google.
    const guardada = buscarEnCache(userId, desde, hasta)
    let vigente = true // si el rango cambió mientras tanto, esta respuesta ya no interesa (igual queda en la caché)
    ;(guardada ? Promise.resolve(guardada) : pedir(userId, desde, hasta))
      .then((entrada) => vigente && setResultado({ clave, entrada, fallo: false }))
      // Si falla se conservan los eventos anteriores y se avisa.
      .catch(() => vigente && setResultado((r) => ({ clave, entrada: r.entrada, fallo: true })))
    return () => {
      vigente = false
    }
  }, [clave, userId, desde, hasta])

  // Al volver a la pestaña: si lo guardado ya venció (o la última llamada falló), se pide de nuevo.
  useEffect(() => {
    if (!activo || !userId || !desde) return
    function alVolver() {
      if (document.visibilityState === 'visible' && !buscarEnCache(userId, desde, hasta)) setVersion((v) => v + 1)
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [activo, userId, desde, hasta])

  const actualizar = useCallback(() => {
    invalidarEventosGoogle()
    setVersion((v) => v + 1)
  }, [])

  const visibles = activo ? resultado.entrada : SIN_DATOS
  return {
    eventos: visibles.eventos,
    estado: visibles.estado,
    truncado: visibles.truncado,
    cargando: !!clave && resultado.clave !== clave,
    error: !!clave && resultado.clave === clave && resultado.fallo,
    actualizar,
  }
}
