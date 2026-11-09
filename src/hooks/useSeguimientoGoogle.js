import { useCallback, useEffect, useMemo, useState } from 'react'
import { camposPendiente } from '../lib/checklist'
import { conjuntoDeSeries, filasPorId, resumenDeEvento } from '../lib/seguimiento'
import {
  borrarSerieSeguida,
  borrarSeguimiento,
  crearSerieSeguida,
  guardarSeguimiento,
  listarSeguimiento,
  listarSeriesSeguidas,
} from '../lib/seguimientoApi'

// Carga lo que el usuario sigue de Google Calendar y permite seguir, dejar de seguir y marcar.
//   const seguimiento = useSeguimientoGoogle()
//   seguimiento.filas, .series         lo guardado (google_seguimiento, google_series_seguidas)
//   seguimiento.porId, .seriesSeguidas  los mismos datos indexados (Map y Set) para buscar rápido
//   seguimiento.cargando, .error
//
// Las acciones reciben un evento del calendario o un "seguido" (los dos traen googleId, serieId,
// titulo, inicio, fin y todoElDia). Si fallan lanzan el error: quien las llama muestra el aviso.
//   seguirEvento(x)        crea la fila con estado 'pendiente'
//   seguirSerie(x)         sigue toda la serie de x
//   marcar(x, campos)      Fui / Justificar: crea la fila si no existía (ocurrencia virtual) o la actualiza
//   deshacer(x)            vuelve a pendiente (ver más abajo)
//   dejarDeSeguir(x)       borra la fila
//   dejarDeSeguirSerie(x)  borra la serie y CONSERVA las filas ya marcadas
export function useSeguimientoGoogle() {
  const [filas, setFilas] = useState([])
  const [series, setSeries] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true // evita actualizar el estado si el componente ya se cerró
    Promise.all([listarSeguimiento(), listarSeriesSeguidas()])
      .then(([f, s]) => {
        if (!activo) return
        setFilas(f)
        setSeries(s)
      })
      .catch(() => activo && setError('No se pudo cargar lo que sigues de Google Calendar.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const porId = useMemo(() => filasPorId(filas), [filas])
  const seriesSeguidas = useMemo(() => conjuntoDeSeries(series), [series])

  // Guarda la fila en pantalla reemplazando la de la misma ocurrencia (nunca queda una repetida).
  const ponerFila = useCallback((fila) => {
    setFilas((actuales) => [...actuales.filter((f) => f.google_event_id !== fila.google_event_id), fila])
  }, [])

  const marcar = useCallback(
    async (x, campos) => {
      ponerFila(await guardarSeguimiento({ ...resumenDeEvento(x), ...campos }))
    },
    [ponerFila],
  )

  const seguirEvento = useCallback((x) => marcar(x, camposPendiente()), [marcar])

  const dejarDeSeguir = useCallback(async (x) => {
    await borrarSeguimiento(x.googleId)
    setFilas((actuales) => actuales.filter((f) => f.google_event_id !== x.googleId))
  }, [])

  const seguirSerie = useCallback(async (x) => {
    const serie = await crearSerieSeguida(x.serieId, x.titulo)
    setSeries((actuales) => [...actuales.filter((s) => s.serie_id !== serie.serie_id), serie])
  }, [])

  const dejarDeSeguirSerie = useCallback(async (x) => {
    await borrarSerieSeguida(x.serieId)
    setSeries((actuales) => actuales.filter((s) => s.serie_id !== x.serieId))
  }, [])

  // Si la serie sigue seguida, la ocurrencia vuelve a ser "virtual" (se borra su fila, como si nunca se hubiera
  // marcado). Si no, la fila es lo único que la hace seguida: se deja en 'pendiente'.
  const deshacer = useCallback(
    (x) => (x.serieId && seriesSeguidas.has(x.serieId) ? dejarDeSeguir(x) : marcar(x, camposPendiente())),
    [seriesSeguidas, dejarDeSeguir, marcar],
  )

  return {
    filas,
    series,
    porId,
    seriesSeguidas,
    cargando,
    error,
    seguirEvento,
    seguirSerie,
    marcar,
    deshacer,
    dejarDeSeguir,
    dejarDeSeguirSerie,
  }
}
