import { hoyEnLima, sumarDias } from '../lib/fechas'

// Fila de botones pequeños que rellenan un campo de un clic.
//   atajos: [{ texto, valor }]    onElegir(valor): se llama con el valor del atajo
export function Atajos({ atajos, onElegir }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {atajos.map(({ texto, valor }) => (
        <button
          key={texto}
          type="button"
          onClick={() => onElegir(valor)}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

// Atajos de fecha: Hoy, Mañana y En 1 semana (siempre contando desde hoy en Lima).
export function AtajosFecha({ onElegir }) {
  const hoy = hoyEnLima()
  return (
    <Atajos
      onElegir={onElegir}
      atajos={[
        { texto: 'Hoy', valor: hoy },
        { texto: 'Mañana', valor: sumarDias(hoy, 1) },
        { texto: 'En 1 semana', valor: sumarDias(hoy, 7) },
      ]}
    />
  )
}
