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
