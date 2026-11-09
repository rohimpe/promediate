import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardarIncluirTodoElDia, obtenerIncluirTodoElDia } from '../lib/profileApi'
import { armarReglas, resumenDeEvento } from '../lib/seguimiento'
import {
  borrarColorEvento,
  borrarColorSerie,
  borrarOculto,
  borrarSeguimiento,
  borrarSeguimientoDeSerie,
  guardarColorEvento,
  guardarColorSerie,
  guardarSeguimiento,
  listarColores,
  listarOcultos,
  listarSeguimiento,
  ocultarEvento,
  ocultarSerie,
} from '../lib/seguimientoApi'
import { useAuth } from './useAuth'

// Carga lo guardado sobre los eventos de Google (marcados, ocultos, colores propios y la preferencia de
// "todo el día") y ofrece las acciones. La página lo crea UNA vez y se lo pasa a lo que lo necesite.
// Todo se pide de una vez al montar: los colores no son una petición por evento.
//   const seguimiento = useSeguimientoGoogle()
//   seguimiento.filas, .ocultos, .colores   google_seguimiento (marcados), google_ocultos y google_colores
//   seguimiento.reglas                  lo mismo indexado (ver armarReglas) para buscar rápido
//   seguimiento.incluirTodoElDia        profiles.google_incluir_todo_el_dia
//   seguimiento.cargando, .error
//
// Las acciones reciben un evento del calendario o un item de Hoy/Pendientes (los dos traen googleId, serieId,
// titulo, inicio, fin y todoElDia). Si fallan lanzan el error: quien las llama muestra el aviso.
//   marcar(x, campos)       Fui / Justificar: crea la fila con el resumen del evento, o la actualiza
//   deshacer(x)             borra la fila: vuelve a ser pendiente
//   quitarEvento(x)         lo oculta (y borra su marca, si tenía)
//   quitarSerie(x)          oculta toda la serie (y borra las marcas de sus ocurrencias)
//   volverAIncluir(oculto)  borra la fila de google_ocultos
//   cambiarIncluirTodoElDia(valor)
//   cambiarColor(x, colorId, alcance)   color propio: alcance 'evento' (solo esta ocurrencia) o 'serie' (toda la serie)
//   restablecerColor(x, alcance)        borra el color propio: vuelve al de Google
export function useSeguimientoGoogle() {
  const { user } = useAuth()
  const userId = user?.id
  const [filas, setFilas] = useState([])
  const [ocultos, setOcultos] = useState([])
  const [colores, setColores] = useState([])
  const [incluirTodoElDia, setIncluirTodoElDia] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let activo = true // evita actualizar el estado si el componente ya se cerró
    Promise.all([
      listarSeguimiento(),
      listarOcultos(),
      obtenerIncluirTodoElDia(userId),
      // Los colores son un adorno: si fallan (el error ya salió en consola), el resto sigue funcionando.
      listarColores().catch(() => []),
    ])
      .then(([f, o, todoElDia, c]) => {
        if (!activo) return
        setFilas(f)
        setOcultos(o)
        setIncluirTodoElDia(todoElDia)
        setColores(c)
      })
      .catch(() => activo && setError('No se pudieron cargar tus eventos de Google.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [userId])

  const reglas = useMemo(
    () => armarReglas(filas, ocultos, incluirTodoElDia, colores),
    [filas, ocultos, incluirTodoElDia, colores],
  )

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

  const deshacer = useCallback(async (x) => {
    await borrarSeguimiento(x.googleId)
    setFilas((actuales) => actuales.filter((f) => f.google_event_id !== x.googleId))
  }, [])

  // Primero se oculta y después se borra la marca: si algo falla a medias, el evento no desaparece sin
  // dejar rastro y basta con reintentar.
  const quitarEvento = useCallback(async (x) => {
    const oculto = await ocultarEvento(x.googleId, x.titulo)
    setOcultos((actuales) => [oculto, ...actuales.filter((o) => o.id !== oculto.id)])
    await borrarSeguimiento(x.googleId)
    setFilas((actuales) => actuales.filter((f) => f.google_event_id !== x.googleId))
  }, [])

  const quitarSerie = useCallback(async (x) => {
    const oculto = await ocultarSerie(x.serieId, x.titulo)
    setOcultos((actuales) => [oculto, ...actuales.filter((o) => o.id !== oculto.id)])
    await borrarSeguimientoDeSerie(x.serieId)
    setFilas((actuales) => actuales.filter((f) => f.serie_id !== x.serieId))
  }, [])

  const volverAIncluir = useCallback(async (oculto) => {
    await borrarOculto(oculto.id)
    setOcultos((actuales) => actuales.filter((o) => o.id !== oculto.id))
  }, [])

  const cambiarIncluirTodoElDia = useCallback(
    async (valor) => {
      await guardarIncluirTodoElDia(userId, valor)
      setIncluirTodoElDia(valor)
    },
    [userId],
  )

  // El color de la ocurrencia manda sobre el de la serie. Por eso, al pintar una serie también se borra el color
  // propio de ESTA ocurrencia (si no, seguiría con el suyo); y al restablecer una serie, igual. Las demás
  // ocurrencias con color propio lo conservan (la base no sabe de qué serie son).
  const cambiarColor = useCallback(
    async (x, colorId, alcance) => {
      const deSerie = alcance === 'serie' && !!x.serieId
      const fila = deSerie ? await guardarColorSerie(x.serieId, colorId) : await guardarColorEvento(x.googleId, colorId)
      const propioDeEvento = deSerie && colores.some((c) => c.google_event_id === x.googleId)
      if (propioDeEvento) await borrarColorEvento(x.googleId)
      // El upsert actualiza la fila existente (mismo id), así que basta reemplazarla.
      setColores((actuales) => [
        ...actuales.filter((c) => c.id !== fila.id && !(propioDeEvento && c.google_event_id === x.googleId)),
        fila,
      ])
    },
    [colores],
  )

  const restablecerColor = useCallback(
    async (x, alcance) => {
      const hayDeSerie = alcance === 'serie' && !!x.serieId && colores.some((c) => c.serie_id === x.serieId)
      const hayDeEvento = colores.some((c) => c.google_event_id === x.googleId)
      if (hayDeSerie) await borrarColorSerie(x.serieId)
      if (hayDeEvento) await borrarColorEvento(x.googleId)
      setColores((actuales) =>
        actuales.filter((c) => !(hayDeSerie && c.serie_id === x.serieId) && !(hayDeEvento && c.google_event_id === x.googleId)),
      )
    },
    [colores],
  )

  return {
    filas,
    ocultos,
    colores,
    reglas,
    incluirTodoElDia,
    cargando,
    error,
    marcar,
    deshacer,
    quitarEvento,
    quitarSerie,
    volverAIncluir,
    cambiarIncluirTodoElDia,
    cambiarColor,
    restablecerColor,
  }
}

