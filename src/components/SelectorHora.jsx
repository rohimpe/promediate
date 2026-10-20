const DOS_DIGITOS = (n) => String(n).padStart(2, '0')
const HORAS = Array.from({ length: 24 }, (_, i) => DOS_DIGITOS(i)) // 00 a 23
const MINUTOS = Array.from({ length: 60 }, (_, i) => DOS_DIGITOS(i)) // 00 a 59

const CLASES_SELECT =
  'min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950'

// Hora en formato de 24 h con dos listas desplegables:  [ HH ] : [ MM ]
//   valor:    'HH:MM' (por ejemplo '23:59') o '' si todavía no se eligió
//   onChange: recibe 'HH:MM' o ''
//   vacio:    si es true, las listas tienen una opción "--" para dejar la hora sin elegir
//
// Los <select> nativos se cierran solos al elegir una opción.
export default function SelectorHora({ id, label, valor, onChange, vacio = false }) {
  const [hh = '', mm = ''] = valor ? valor.split(':') : []

  // Si se elige una parte y la otra está vacía, la otra queda en "00",
  // así la hora siempre está completa o completamente vacía.
  function cambiar(nuevaHora, nuevosMinutos) {
    if (!nuevaHora && !nuevosMinutos) return onChange('')
    onChange(`${nuevaHora || '00'}:${nuevosMinutos || '00'}`)
  }

  return (
    <div>
      <label htmlFor={`${id}-horas`} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <select
          id={`${id}-horas`}
          aria-label={`${label}: horas`}
          value={hh}
          onChange={(e) => cambiar(e.target.value, mm)}
          className={CLASES_SELECT}
        >
          {vacio && <option value="">--</option>}
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="text-lg font-semibold">
          :
        </span>
        <select
          id={`${id}-minutos`}
          aria-label={`${label}: minutos`}
          value={mm}
          onChange={(e) => cambiar(hh, e.target.value)}
          className={CLASES_SELECT}
        >
          {vacio && <option value="">--</option>}
          {MINUTOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
