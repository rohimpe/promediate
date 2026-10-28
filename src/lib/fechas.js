// Utilidades de fechas. TODO se calcula en la zona horaria de Lima,
// nunca en la del navegador ni la del servidor.
export const ZONA = 'America/Lima'

// Lima está en UTC-5 todo el año (no usa horario de verano).
const OFFSET_LIMA = '-05:00'

// Devuelve las partes (año, mes, día, hora, minuto) de un instante, vistas desde Lima.
function partesEnLima(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  return Object.fromEntries(partes.map((p) => [p.type, p.value]))
}

// 'YYYY-MM-DD' del día de hoy en Lima.
export function hoyEnLima(ahora = new Date()) {
  const p = partesEnLima(ahora)
  return `${p.year}-${p.month}-${p.day}`
}

// 'YYYY-MM-DD' (en Lima) de un timestamp que viene de la base de datos.
export function fechaEnLima(timestamp) {
  return hoyEnLima(new Date(timestamp))
}

// Días de diferencia entre dos fechas 'YYYY-MM-DD' (b - a). Se hace en UTC
// para que no influyan horarios de verano ni la zona del navegador.
export function diasEntre(a, b) {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

// --- Conversión con los inputs del formulario ---

// timestamp de la BD -> valor para <input type="datetime-local"> ('YYYY-MM-DDTHH:mm', hora de Lima)
export function aInputDatetime(timestamp) {
  if (!timestamp) return ''
  const p = partesEnLima(new Date(timestamp))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// valor de <input type="datetime-local"> (hora de Lima) -> texto ISO que Postgres entiende
export function deInputDatetime(valor) {
  return valor ? `${valor}:00${OFFSET_LIMA}` : null
}

// --- Para mostrar al usuario ---

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// 'YYYY-MM-DD' -> '18 oct'
export function formatearFecha(fecha) {
  const [, m, d] = fecha.split('-').map(Number)
  return `${d} ${MESES[m - 1]}`
}

// timestamp -> '18 oct, 14:30' (hora de Lima)
export function formatearFechaHora(timestamp) {
  const p = partesEnLima(new Date(timestamp))
  return `${formatearFecha(`${p.year}-${p.month}-${p.day}`)}, ${p.hour}:${p.minute}`
}

// 'YYYY-MM-DD' -> 'lunes 19 de octubre'
export function formatearDiaLargo(fecha) {
  // Mediodía de Lima: así el día no cambia aunque haya pequeñas diferencias de zona.
  return new Date(`${fecha}T12:00:00${OFFSET_LIMA}`).toLocaleDateString('es-PE', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// 'YYYY-MM-DD' + n días -> 'YYYY-MM-DD' (en UTC, para que no influya la zona del navegador)
export function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// --- Para el calendario ---

// Instante a partir de una fecha y hora de Lima: ('2026-10-19', '14:30' o '14:30:00') -> Date
export function instanteLima(fecha, hora) {
  return new Date(`${fecha}T${hora.slice(0, 5)}:00${OFFSET_LIMA}`)
}

// Minutos desde las 00:00 (hora de Lima) de un instante: 14:30 -> 870
export function minutosEnLima(instante) {
  const p = partesEnLima(instante)
  return Number(p.hour) * 60 + Number(p.minute)
}

// 'HH:MM' (hora de Lima) de un instante
export function horaEnLima(instante) {
  const p = partesEnLima(instante)
  return `${p.hour}:${p.minute}`
}

const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

// Día de la semana empezando en lunes: 0 = lunes … 6 = domingo.
export function diaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export function nombreDiaCorto(fecha) {
  return DIAS_CORTOS[diaSemana(fecha)]
}

// Lunes de la semana que contiene a "fecha".
export function inicioSemana(fecha) {
  return sumarDias(fecha, -diaSemana(fecha))
}

export function diasEnMes(fecha) {
  const [y, m] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function inicioMes(fecha) {
  return `${fecha.slice(0, 8)}01`
}

// Suma n meses. Si el día no existe en el mes nuevo (31 -> febrero), usa el último día.
export function sumarMeses(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number)
  const primero = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 8)
  const dia = Math.min(d, diasEnMes(`${primero}01`))
  return `${primero}${String(dia).padStart(2, '0')}`
}

// 'YYYY-MM-DD' -> 'octubre 2026'
export function formatearMesAnio(fecha) {
  return new Date(`${fecha}T12:00:00${OFFSET_LIMA}`).toLocaleDateString('es-PE', {
    timeZone: ZONA,
    month: 'long',
    year: 'numeric',
  })
}

// ('2026-10-19', '2026-10-25') -> '19 – 25 oct 2026' (o '28 sep – 4 oct 2026' si cruza de mes)
export function formatearRango(desde, hasta) {
  const [ya, ma, da] = desde.split('-').map(Number)
  const [yb, mb, db] = hasta.split('-').map(Number)
  const izq = ma === mb ? `${da}` : `${da} ${MESES[ma - 1]}`
  const der = `${db} ${MESES[mb - 1]}`
  return ya === yb ? `${izq} – ${der} ${yb}` : `${da} ${MESES[ma - 1]} ${ya} – ${der} ${yb}`
}

// Días restantes (ver diasRestantes en priority.js) -> 'Hoy', 'Mañana', 'En 3 días', 'Ayer', 'Hace 2 días'
export function textoPlazo(dias) {
  if (dias === null) return ''
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias > 1) return `En ${dias} días`
  return dias === -1 ? 'Ayer' : `Hace ${-dias} días`
}
