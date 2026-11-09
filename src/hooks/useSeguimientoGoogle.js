import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardarIncluirTodoElDia, obtenerIncluirTodoElDia } from '../lib/profileApi'
import { armarReglas, resumenDeEvento } from '../lib/seguimiento'
import {
  borrarOculto,
  borrarSeguimiento,
  borrarSeguimientoDeSerie,
  guardarSeguimiento,
  listarOcultos,
  listarSeguimiento,
  ocultarEvento,
  ocultarSerie,
} from '../lib/seguimientoApi'
import { useAuth } from './useAuth'

// Carga lo guardado sobre los eventos de Google (marcados, ocultos y la preferencia de "todo el día") y
// ofrece las acciones. La página lo crea UNA vez y se lo pasa a lo que lo necesite.
//   const seguimiento = useSeguimientoGoogle()
//   seguimiento.filas, .ocultos         google_seguimiento (marcados) y google_ocultos
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
export function useSeguimientoGoogle() {
  const { user } = useAuth()
  const userId = user?.id
  const [filas, setFilas] = useState([])
  const [ocultos, setOcultos] = useState([])
  const [incluirTodoElDia, setIncluirTodoElDia] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let activo = true // evita actualizar el estado si el componente ya se cerró
    Promise.all([listarSeguimiento(), listarOcultos(), obtenerIncluirTodoElDia(userId)])
      .then(([f, o, todoElDia]) => {
        if (!activo) return
        setFilas(f)
        setOcultos(o)
        setIncluirTodoElDia(todoElDia)
      })
      .catch(() => activo && setError('No se pudieron cargar tus eventos de Google.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [userId])

  const reglas = useMemo(() => armarReglas(filas, ocultos, incluirTodoElDia), [filas, ocultos, incluirTodoElDia])

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

  return {
    filas,
    ocultos,
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
  }
}

