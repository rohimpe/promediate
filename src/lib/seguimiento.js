import { COLOR_GOOGLE } from './calendario'
import { fechaEnLima, horaEnLima, sumarDias } from './fechas'

// ---------------------------------------------------------------------
// Eventos de Google Calendar como pendientes (Fase 3, parte B2).
//
// Los eventos de Google ENTRAN SOLOS a Hoy y Pendientes. El usuario puede quitar los que no quiera.
// Un evento entra si:
//   - tiene hora, o es de todo el día y el usuario activó "incluir eventos de todo el día"; y
//   - su `googleId` no está en `google_ocultos`; y
//   - su `serieId` no está en `google_ocultos`.
//
// Su estado sale de `google_seguimiento`: sin fila = pendiente (virtual, no se guarda);
// con fila = completada o justificada. Si ya hay fila, esa manda sobre cualquier otra regla.
//
// Todo lo que se muestra en Hoy / Pendientes / Inicio es un "item" con esta forma:
//   id, origen: 'google', tipo: 'evento', googleId, serieId, titulo,
//   inicio (Date), fin (Date | null), todoElDia,
//   estado ('pendiente' | 'completada' | 'justificada'), justificacion,
//   color         el de su colorId en Google (las filas guardadas lo toman del evento si Google aún lo devuelve)
//   guardado     true si tiene fila en la base de datos (false = pendiente virtual)
//   soloGuardado  true si se muestra solo por su resumen guardado (Google no está disponible o ya
//                 no devuelve el evento): la pantalla le pone la nota "(guardado)"
// Es compatible con <AccionesChecklist> (usa id, estado y justificacion).
// ---------------------------------------------------------------------

// Pendientes > Google: los próximos 14 días, y los últimos 7 solo si siguen sin marcar.
export const DIAS_ADELANTE = 14
export const DIAS_ATRAS = 7

// Días de Lima ('YYYY-MM-DD') que se le piden a Google para Inicio, Hoy y Pendientes. Es el MISMO rango en
// las tres páginas: así comparten una sola petición (y la caché de useGoogleEventos).
export function rangoPendientesGoogle(hoy) {
  return { desde: sumarDias(hoy, -DIAS_ATRAS), hasta: sumarDias(hoy, DIAS_ADELANTE) }
}

// Resumen que se guarda en google_seguimiento. Sirve tanto para un evento del calendario como
// para un item (los dos tienen googleId, serieId, titulo, inicio, fin y todoElDia).
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

// Lo guardado, indexado para buscar rápido. Es lo único que necesitan las demás funciones.
//   filas:   google_seguimiento (eventos marcados)
//   ocultos: google_ocultos
//   incluirTodoElDia: profiles.google_incluir_todo_el_dia
export function armarReglas(filas, ocultos, incluirTodoElDia) {
  return {
    porId: new Map(filas.map((f) => [f.google_event_id, f])),
    ocultosEventos: new Set(ocultos.filter((o) => o.google_event_id).map((o) => o.google_event_id)),
    ocultosSeries: new Set(ocultos.filter((o) => o.serie_id).map((o) => o.serie_id)),
    incluirTodoElDia: !!incluirTodoElDia,
  }
}

// ¿Este evento de Google (del calendario o de la función) entra a pendientes?
export function entraAPendientes(evento, reglas) {
  if (reglas.porId.has(evento.googleId)) return true // ya marcado: esa fila manda
  if (evento.todoElDia && !reglas.incluirTodoElDia) return false
  if (reglas.ocultosEventos.has(evento.googleId)) return false
  if (evento.serieId && reglas.ocultosSeries.has(evento.serieId)) return false
  return true
}

// Evento de Google del calendario con el estado de sus pendientes. Los que no entran (ocultos, o de todo el
// día con el interruptor apagado) quedan como un evento normal de solo lectura.
export function conEstadoDePendiente(evento, reglas) {
  if (!entraAPendientes(evento, reglas)) return evento
  const fila = reglas.porId.get(evento.googleId)
  return { ...evento, enPendientes: true, estado: fila?.estado ?? 'pendiente' }
}

function filaAItem(fila, color) {
  return {
    id: `google:${fila.google_event_id}`,
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
    color,
    guardado: true,
    soloGuardado: false,
  }
}

// Evento de Google que entra a pendientes y todavía no tiene fila: pendiente virtual.
function eventoAItem(evento) {
  return {
    id: `google:${evento.googleId}`,
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
    color: evento.color,
    guardado: false,
    soloGuardado: false,
  }
}

// Todos los eventos de Google que son pendientes: las filas guardadas + los eventos de Google que entran.
//
//   filas, reglas:  lo guardado (google_seguimiento) y las reglas de armarReglas
//   eventos:        eventos de Google ya normalizados (googleAEventos) del rango pedido
//   estadoGoogle:   'ok' | 'no_conectado' | 'reconectar'… o null si todavía no hay respuesta
//   truncado:       Google tenía más eventos de los que se trajeron
//   rango:          { desde, hasta } de los eventos pedidos (solo ahí se puede decir "ya no está en Google")
//
// SIN DUPLICADOS: la clave de cada evento es su googleId (único por ocurrencia). Primero entran las filas
// guardadas, que ganan siempre; un evento de Google solo se agrega si su googleId NO tiene fila. Así una serie
// con ocurrencias ya marcadas muestra cada una una sola vez: las marcadas desde su fila y las demás, virtuales.
// Si Google no está disponible, `eventos` llega vacío y solo se ven las filas.
export function combinarEventosGoogle(filas, reglas, eventos, { estadoGoogle = null, truncado = false, rango = null } = {}) {
  const vivos = new Map(eventos.map((e) => [e.googleId, e]))

  const items = filas.map((fila) => {
    const item = filaAItem(fila, vivos.get(fila.google_event_id)?.color ?? COLOR_GOOGLE)
    const dia = fechaEnLima(item.inicio)
    const enRango = !!rango && dia >= rango.desde && dia <= rango.hasta
    item.soloGuardado =
      estadoGoogle !== null && enRango && (estadoGoogle !== 'ok' || (!truncado && !vivos.has(item.googleId)))
    return item
  })

  const yaAgregados = new Set() // un evento de varios días llega partido por día, con el mismo googleId
  for (const e of eventos) {
    if (reglas.porId.has(e.googleId) || yaAgregados.has(e.googleId)) continue
    if (!entraAPendientes(e, reglas)) continue
    yaAgregados.add(e.googleId)
    items.push(eventoAItem(e))
  }

  return items
}

// 'Todo el día', '10:00–11:30' o '10:00' (hora de Lima).
export function horarioEvento(s) {
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

// Los eventos de Google que caen hoy (hora de Lima), por hora:
//   { eventos, pendientes, hechas, total }  ("X de Y" = hechas.length de total)
export function eventosDeHoy(items, hoy) {
  const eventos = ordenarPorHora(items.filter((s) => fechaEnLima(s.inicio) === hoy))
  const pendientes = eventos.filter((s) => s.estado === 'pendiente')
  return { eventos, pendientes, hechas: eventos.length - pendientes.length, total: eventos.length }
}

// Lista de Pendientes > Google, por fecha:
//   - hoy y los próximos 14 días: todos (marcados o no)
//   - los últimos 7 días: solo los que siguen sin marcar, con `sinMarcar: true`
// Lo más viejo que eso, sin marcar, no se muestra.
export function eventosParaPendientes(items, hoy) {
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
