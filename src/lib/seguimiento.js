import { fechaEnLima, horaEnLima, sumarDias } from './fechas'

// ---------------------------------------------------------------------
// Seguir eventos de Google Calendar (Fase 3, parte B2).
//
// Un evento de Google cuenta como "seguido" si:
//   a) su `googleId` está en `google_seguimiento` (una fila: lo siguió o ya lo marcó), o
//   b) su `serieId` está en `google_series_seguidas` (sigue toda la serie).
//
// Las ocurrencias de una serie seguida son pendientes VIRTUALES: se construyen al vuelo a partir
// de los eventos de Google y no se guardan hasta que el usuario hace Fui o Justificar.
//
// Todo lo que se muestra en Hoy / Pendientes / Inicio es un "seguido" (item) con esta forma:
//   id, origen: 'google', tipo: 'evento', googleId, serieId, titulo,
//   inicio (Date), fin (Date | null), todoElDia,
//   estado ('pendiente' | 'completada' | 'justificada'), justificacion,
//   guardado      true si tiene fila en la base de datos (false = virtual de una serie)
//   soloGuardado  true si se muestra solo por su resumen guardado (Google no está disponible o ya
//                 no devuelve el evento): la pantalla le pone la nota "(guardado)"
// Es compatible con <AccionesChecklist> (usa id, estado y justificacion).
// ---------------------------------------------------------------------

// Pendientes > Google: los próximos 14 días, y los últimos 7 solo si siguen sin marcar.
export const DIAS_ADELANTE = 14
export const DIAS_ATRAS = 7

// Días de Lima ('YYYY-MM-DD') que hay que pedirle a Google para la lista de Pendientes.
export function rangoPendientesGoogle(hoy) {
  return { desde: sumarDias(hoy, -DIAS_ATRAS), hasta: sumarDias(hoy, DIAS_ADELANTE) }
}

// Resumen que se guarda en google_seguimiento. Sirve tanto para un evento del calendario como
// para un seguido (los dos tienen googleId, serieId, titulo, inicio, fin y todoElDia).
export function resumenDeEvento(x) {
  return {
    google_event_id: x.googleId,
    serie_id: x.serieId ?? null,
    titulo: x.titulo,
    inicio: x.inicio.toISOString(),
    fin: x.fin ? x.fin.toISOString() : null,
    todo_el_dia: !!x.todoElDia,
  }
}

function filaASeguido(fila) {
  return {
    id: `seguido:${fila.google_event_id}`,
    origen: 'google',
    tipo: 'evento',
    googleId: fila.google_event_id,
    serieId: fila.serie_id,
    titulo: fila.titulo,
    inicio: new Date(fila.inicio),
    fin: fila.fin ? new Date(fila.fin) : null,
    todoElDia: fila.todo_el_dia,
    estado: fila.estado,
    justificacion: fila.justificacion,
    guardado: true,
    soloGuardado: false,
  }
}

// Ocurrencia de una serie seguida que aún no tiene fila.
function eventoASeguido(evento) {
  return {
    id: `seguido:${evento.googleId}`,
    origen: 'google',
    tipo: 'evento',
    googleId: evento.googleId,
    serieId: evento.serieId,
    titulo: evento.titulo,
    inicio: evento.inicio,
    fin: evento.fin,
    todoElDia: evento.todoElDia,
    estado: 'pendiente',
    justificacion: null,
    guardado: false,
    soloGuardado: false,
  }
}

// Búsquedas rápidas: ocurrencia -> fila, y conjunto de series seguidas.
export function filasPorId(filas) {
  return new Map(filas.map((f) => [f.google_event_id, f]))
}
export function conjuntoDeSeries(series) {
  return new Set(series.map((s) => s.serie_id))
}

// Todos los seguidos: las filas guardadas + las ocurrencias virtuales de las series seguidas.
//
//   filas, series:  lo guardado (google_seguimiento, google_series_seguidas)
//   eventos:        eventos de Google ya normalizados (googleAEventos) del rango pedido
//   estadoGoogle:   'ok' | 'no_conectado' | 'reconectar'… o null si todavía no hay respuesta
//   truncado:       Google tenía más eventos de los que se trajeron
//   rango:          { desde, hasta } de los eventos pedidos (solo ahí se puede decir "ya no está en Google")
//
// SIN DUPLICADOS: cada ocurrencia tiene un googleId único. Primero entran las filas guardadas (que ganan
// siempre); una ocurrencia virtual solo se agrega si su googleId NO tiene fila. Así, una serie seguida
// con ocurrencias ya marcadas muestra cada una una sola vez: las marcadas desde su fila y el resto virtuales.
export function combinarSeguidos(filas, series, eventos, { estadoGoogle = null, truncado = false, rango = null } = {}) {
  const seriesSeguidas = conjuntoDeSeries(series)
  const vivos = new Set(eventos.map((e) => e.googleId))
  const tieneFila = new Set(filas.map((f) => f.google_event_id))

  const items = filas.map((fila) => {
    const item = filaASeguido(fila)
    const dia = fechaEnLima(item.inicio)
    const enRango = !!rango && dia >= rango.desde && dia <= rango.hasta
    item.soloGuardado =
      estadoGoogle !== null && enRango && (estadoGoogle !== 'ok' || (!truncado && !vivos.has(item.googleId)))
    return item
  })

  const yaAgregados = new Set() // un evento de varios días llega partido por día, con el mismo googleId
  for (const e of eventos) {
    if (!e.serieId || !seriesSeguidas.has(e.serieId)) continue
    if (tieneFila.has(e.googleId) || yaAgregados.has(e.googleId)) continue
    yaAgregados.add(e.googleId)
    items.push(eventoASeguido(e))
  }

  return items
}

// ¿Lo sigue el usuario? { fila, porSerie, seguido }. Para el panel y para el calendario.
export function infoSeguimiento(evento, porId, seriesSeguidas) {
  const fila = porId.get(evento.googleId) ?? null
  const porSerie = !!evento.serieId && seriesSeguidas.has(evento.serieId)
  return { fila, porSerie, seguido: !!fila || porSerie }
}

// Evento de Google del calendario con el estado de su seguimiento (los no seguidos quedan igual).
export function conSeguimiento(evento, porId, seriesSeguidas) {
  const { fila, seguido } = infoSeguimiento(evento, porId, seriesSeguidas)
  return seguido ? { ...evento, seguido: true, estado: fila?.estado ?? 'pendiente' } : evento
}

// 'Todo el día', '10:00–11:30' o '10:00' (hora de Lima).
export function horarioSeguido(s) {
  if (s.todoElDia) return 'Todo el día'
  if (!s.fin || s.fin <= s.inicio) return horaEnLima(s.inicio)
  return `${horaEnLima(s.inicio)}–${horaEnLima(s.fin)}`
}

// Todo el día primero; luego por hora.
export function ordenarPorHora(items) {
  return [...items].sort(
    (a, b) =>
      Number(b.todoElDia) - Number(a.todoElDia) || a.inicio - b.inicio || a.titulo.localeCompare(b.titulo, 'es'),
  )
}

// Lo seguido que cae hoy (hora de Lima): { pendientes, hechas }, ambos ordenados por hora.
export function seguidosDeHoy(items, hoy) {
  const deHoy = items.filter((s) => fechaEnLima(s.inicio) === hoy)
  return {
    pendientes: ordenarPorHora(deHoy.filter((s) => s.estado === 'pendiente')),
    hechas: ordenarPorHora(deHoy.filter((s) => s.estado !== 'pendiente')),
  }
}

// Lista de Pendientes > Google, por fecha:
//   - hoy y los próximos 14 días: todos los seguidos (marcados o no)
//   - los últimos 7 días: solo los que siguen sin marcar, con `sinMarcar: true`
// Lo más viejo que eso, sin marcar, no se muestra.
export function seguidosParaPendientes(items, hoy) {
  const limite = sumarDias(hoy, DIAS_ADELANTE)
  const desde = sumarDias(hoy, -DIAS_ATRAS)
  const lista = []

  for (const s of items) {
    const dia = fechaEnLima(s.inicio)
    if (dia >= hoy && dia <= limite) lista.push({ ...s, sinMarcar: false })
    else if (dia >= desde && dia < hoy && s.estado === 'pendiente') lista.push({ ...s, sinMarcar: true })
  }

  // Por día; dentro de cada día, igual que en Hoy (todo el día primero y luego por hora).
  return lista.sort(
    (a, b) =>
      fechaEnLima(a.inicio).localeCompare(fechaEnLima(b.inicio)) ||
      Number(b.todoElDia) - Number(a.todoElDia) ||
      a.inicio - b.inicio ||
      a.titulo.localeCompare(b.titulo, 'es'),
  )
}
