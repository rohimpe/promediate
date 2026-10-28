import { fechaEnLima, instanteLima, minutosEnLima } from './fechas'
import { estaVencida } from './priority'
import { HORA_ENTREGA_POR_DEFECTO } from './tipos'

// ---------------------------------------------------------------------
// Evento normalizado: es lo único que entiende <CalendarView>.
//
//   id          texto único
//   titulo      texto
//   inicio      Date (instante). Una entrega tiene inicio = fin = su hora límite.
//   fin         Date
//   todoElDia   true si no tiene hora (se muestra en la franja de arriba)
//   tipo        'entrega' | 'actividad'   (en la Fase 3: también 'evento' de Google)
//   color       '#rrggbb'
//   estado      'pendiente' | 'completada' | 'justificada' | 'vencida'
//   origen      'app' | 'google'
//   curso       nombre del curso o null (solo informativo)
// ---------------------------------------------------------------------

// Color fijo de las actividades (las entregas usan el color de su curso).
export const COLOR_ACTIVIDAD = '#14b8a6'
// Entrega sin curso: el índigo de la app.
export const COLOR_SIN_CURSO = '#6366f1'
// Color de lo justificado (se ve apagado).
export const COLOR_JUSTIFICADA = '#9ca3af'

// Convierte las filas de `tasks` en eventos normalizados. Los pendientes sin fecha
// no tienen lugar en el calendario y se omiten.
export function tareasAEventos(tareas) {
  const eventos = []

  for (const t of tareas) {
    let inicio
    let fin
    let todoElDia = false

    if (t.tipo === 'tarea') {
      if (!t.fecha_entrega) continue
      inicio = fin = new Date(t.fecha_entrega)
    } else {
      if (!t.fecha_actividad) continue
      if (t.hora_inicio && t.hora_fin) {
        inicio = instanteLima(t.fecha_actividad, t.hora_inicio)
        fin = instanteLima(t.fecha_actividad, t.hora_fin)
      } else {
        inicio = fin = instanteLima(t.fecha_actividad, '00:00')
        todoElDia = true
      }
    }

    eventos.push({
      id: t.id,
      titulo: t.titulo,
      inicio,
      fin,
      todoElDia,
      tipo: t.tipo === 'tarea' ? 'entrega' : 'actividad',
      color: t.tipo === 'tarea' ? (t.courses?.color ?? COLOR_SIN_CURSO) : COLOR_ACTIVIDAD,
      estado: estaVencida(t) ? 'vencida' : t.estado,
      origen: 'app',
      curso: t.courses?.nombre ?? null,
    })
  }

  return eventos
}

// Agrupa por día en Lima: Map('YYYY-MM-DD' -> eventos de ese día, ordenados por hora).
export function agruparPorDia(eventos) {
  const mapa = new Map()
  for (const e of [...eventos].sort((a, b) => a.inicio - b.inicio)) {
    const dia = fechaEnLima(e.inicio)
    if (!mapa.has(dia)) mapa.set(dia, [])
    mapa.get(dia).push(e)
  }
  return mapa
}

// --- Crear un pendiente tocando el calendario ---
// Cada función devuelve los "valores iniciales" que entiende <PendienteForm>.

const ULTIMO_CUARTO = 23 * 60 + 45 // 23:45: el último inicio posible (la hora de fin cabe en el mismo día)
const ULTIMA_HORA = 23 * 60 + 59

function minutosAHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

// Toque en la cuadrícula de horas. `y` son los píxeles desde la parte de arriba de la columna
// del día (las 00:00). Se convierte a minutos (y / pxPorHora * 60), se redondea al cuarto de
// hora más cercano y la actividad dura una hora (sin pasarse de las 23:59).
export function valoresDeToqueEnHoras(fecha, y, pxPorHora) {
  const minutos = Math.round(((y / pxPorHora) * 60) / 15) * 15
  const inicio = Math.min(Math.max(minutos, 0), ULTIMO_CUARTO)
  return {
    tipo: 'actividad',
    fecha,
    horaInicio: minutosAHora(inicio),
    horaFin: minutosAHora(Math.min(inicio + 60, ULTIMA_HORA)),
  }
}

// Toque en el encabezado de un día: una entrega con la hora límite por defecto.
export function valoresDeEncabezado(fecha) {
  return { tipo: 'tarea', fecha, horaEntrega: HORA_ENTREGA_POR_DEFECTO }
}

// --- Posición de los bloques en la cuadrícula de horas ---

// Todo bloque ocupa al menos 30 min de alto para poder leerse (una entrega dura 0 min).
const MINUTOS_MINIMOS = 30
const MINUTOS_EN_DIA = 24 * 60

// Calcula dónde dibujar cada evento con horario de UN día.
//   top    = minutos desde las 00:00 × (pxPorHora / 60)
//   height = duración en minutos × (pxPorHora / 60)
// Si dos eventos se pisan en el tiempo, se reparten en columnas lado a lado.
// Devuelve [{ evento, top, height, columna, columnas }] (px), listo para posicionar.
export function posicionarEventos(eventos, pxPorHora) {
  const pxPorMinuto = pxPorHora / 60

  const items = eventos
    .filter((e) => !e.todoElDia)
    .map((evento) => {
      const ini = minutosEnLima(evento.inicio)
      const duracion = Math.max((evento.fin - evento.inicio) / 60_000, MINUTOS_MINIMOS)
      return { evento, ini, fin: Math.min(ini + duracion, MINUTOS_EN_DIA), columna: 0, columnas: 1 }
    })
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin)

  // Un "grupo" son eventos que se encadenan por solapes. Dentro de un grupo, cada
  // evento va en la primera columna que ya esté libre a su hora de inicio.
  let grupo = []
  let finColumnas = [] // finColumnas[i] = minuto en que termina lo último puesto en la columna i
  let finGrupo = -1

  function cerrarGrupo() {
    for (const it of grupo) it.columnas = finColumnas.length
    grupo = []
    finColumnas = []
  }

  for (const it of items) {
    if (it.ini >= finGrupo) cerrarGrupo() // no se pisa con el grupo anterior: grupo nuevo
    let c = finColumnas.findIndex((fin) => fin <= it.ini)
    if (c === -1) c = finColumnas.length
    finColumnas[c] = it.fin
    it.columna = c
    grupo.push(it)
    finGrupo = Math.max(finGrupo, it.fin)
  }
  cerrarGrupo()

  return items.map((it) => ({
    evento: it.evento,
    top: it.ini * pxPorMinuto,
    height: (it.fin - it.ini) * pxPorMinuto,
    columna: it.columna,
    columnas: it.columnas,
  }))
}
