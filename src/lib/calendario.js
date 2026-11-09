import {
  diasEnMes,
  diaSemana,
  diasEntre,
  fechaEnLima,
  inicioMes,
  inicioSemana,
  instanteLima,
  minutosEnLima,
  sumarDias,
} from './fechas'
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
//   tipo        'entrega' | 'actividad' | 'evento' (los de Google)
//   color       '#rrggbb' (en los de Google, el de su colorId: ver colorGoogle; CalendarioConGoogle lo
//               reemplaza por el elegido en la app, ver colorDeEvento en seguimiento.js)
//   estado      'pendiente' | 'completada' | 'justificada' | 'vencida'
//   origen      'app' | 'google'
//   curso       nombre del curso o null (solo informativo)
//
// Solo los eventos de Google traen además:
//   googleId    id de la ocurrencia en Google
//   serieId     id de la serie repetitiva o null
//   lugar       texto o null
//   enlace      dirección https de Google Calendar o null
//   enPendientes true si entra a Hoy y Pendientes (ver seguimiento.js); entonces `estado` es el de sus pendientes
// ---------------------------------------------------------------------

// Color fijo de las actividades (las entregas usan el color de su curso).
export const COLOR_ACTIVIDAD = '#14b8a6'
// Colores de los eventos de Google Calendar: los mismos que muestra Google para cada `colorId` ('1'…'11').
// Un evento sin colorId usa el color del calendario: el azul por defecto de Google (COLOR_GOOGLE).
export const COLOR_GOOGLE = '#039be5'
const COLORES_GOOGLE = {
  1: '#7986cb',
  2: '#33b679',
  3: '#8e24aa',
  4: '#e67c73',
  5: '#f6bf26',
  6: '#f4511e',
  7: '#039be5',
  8: '#616161',
  9: '#3f51b5',
  10: '#0b8043',
  11: '#d50000',
}

export function colorGoogle(colorId) {
  return COLORES_GOOGLE[colorId] ?? COLOR_GOOGLE
}

// Los 11 colores de la paleta para el selector, con el nombre que les da Google Calendar.
export const PALETA_GOOGLE = [
  { colorId: '1', nombre: 'Lavanda' },
  { colorId: '2', nombre: 'Salvia' },
  { colorId: '3', nombre: 'Uva' },
  { colorId: '4', nombre: 'Flamenco' },
  { colorId: '5', nombre: 'Banana' },
  { colorId: '6', nombre: 'Mandarina' },
  { colorId: '7', nombre: 'Pavo real' },
  { colorId: '8', nombre: 'Grafito' },
  { colorId: '9', nombre: 'Arándano' },
  { colorId: '10', nombre: 'Albahaca' },
  { colorId: '11', nombre: 'Tomate' },
].map((c) => ({ ...c, valor: COLORES_GOOGLE[c.colorId] }))
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

// Un evento de todo el día que dura meses no tiene sentido dibujarlo día por día más allá de esto.
const MAX_DIAS_TODO_EL_DIA = 62
const FECHA = /^\d{4}-\d{2}-\d{2}$/

// Convierte los eventos que devuelve la función google-calendar-events en eventos normalizados.
//
// - Con hora: Google manda un instante con su offset original ("2026-11-10T09:00:00+01:00").
//   new Date() lo convierte al instante real, y toda la app lo muestra en Lima (horaEnLima,
//   fechaEnLima…), así que el offset de origen ya no importa.
// - De todo el día: Google manda fechas sin hora ('2026-11-10', fin exclusivo). NO se pasan por
//   new Date('2026-11-10') (eso es la medianoche UTC, que en Lima es el día anterior a las 19:00):
//   se toman como días del calendario de Lima. Si dura varios días, sale un evento por día.
export function googleAEventos(lista) {
  const eventos = []

  for (const g of lista) {
    const comun = {
      googleId: g.id, // id de la ocurrencia en Google (el `id` del evento normalizado lleva prefijo y, a veces, el día)
      serieId: g.serieId ?? null, // id de la serie repetitiva, o null si es un evento suelto
      titulo: g.titulo,
      todoElDia: g.todoElDia,
      tipo: 'evento',
      colorId: g.colorId ?? null, // el de Google, sin tocar: el selector de color lo usa para decir de dónde viene el color
      color: colorGoogle(g.colorId),
      estado: 'pendiente',
      origen: 'google',
      curso: null,
      lugar: g.lugar ?? null,
      // Solo enlaces https: el enlace viene de fuera y acaba en un <a href>.
      enlace: typeof g.enlace === 'string' && g.enlace.startsWith('https://') ? g.enlace : null,
    }

    if (g.todoElDia) {
      if (!FECHA.test(g.inicio)) continue
      const dias = FECHA.test(g.fin) ? diasEntre(g.inicio, g.fin) : 1
      for (let i = 0; i < Math.min(Math.max(dias, 1), MAX_DIAS_TODO_EL_DIA); i++) {
        const dia = sumarDias(g.inicio, i)
        const medianoche = instanteLima(dia, '00:00')
        eventos.push({ ...comun, id: `google:${g.id}:${dia}`, inicio: medianoche, fin: medianoche })
      }
    } else {
      const inicio = new Date(g.inicio)
      const fin = new Date(g.fin)
      if (Number.isNaN(inicio.getTime())) continue
      eventos.push({
        ...comun,
        id: `google:${g.id}`,
        inicio,
        fin: Number.isNaN(fin.getTime()) || fin < inicio ? inicio : fin,
      })
    }
  }

  return eventos
}

// Días ('YYYY-MM-DD', ambos incluidos) que muestra una vista del calendario con `fecha` como
// día de referencia. Con esto se sabe qué rango pedirle a Google.
export function rangoDeVista(vista, fecha) {
  if (vista === 'mes') {
    const primero = inicioMes(fecha)
    const semanas = Math.ceil((diaSemana(primero) + diasEnMes(fecha)) / 7) // igual que VistaMes
    const desde = inicioSemana(primero)
    return { desde, hasta: sumarDias(desde, semanas * 7 - 1) }
  }
  if (vista === 'semana') {
    const lunes = inicioSemana(fecha)
    return { desde: lunes, hasta: sumarDias(lunes, 6) }
  }
  return { desde: fecha, hasta: fecha }
}

// Rango de días de Lima (hasta incluido) -> instantes ISO [desde, hasta) para la función de Google:
// de las 00:00 del primer día a las 00:00 del día siguiente al último.
export function rangoAInstantes({ desde, hasta }) {
  return {
    desde: instanteLima(desde, '00:00').toISOString(),
    hasta: instanteLima(sumarDias(hasta, 1), '00:00').toISOString(),
  }
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
