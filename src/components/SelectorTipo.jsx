// Dos tarjetas grandes para elegir entre Entrega y Actividad.
// Por dentro son radio buttons (accesibles con teclado y lectores de pantalla),
// ocultos visualmente: la tarjeta es la <label>.

function IconoEntrega() {
  // Documento con líneas de texto
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

function IconoActividad() {
  // Calendario con reloj
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="12" cy="15" r="2.5" />
      <path d="M12 14v1.2l.8.5" />
    </svg>
  )
}

const OPCIONES = [
  { valor: 'tarea', titulo: 'Entrega', detalle: 'Universidad · fecha y hora límite', Icono: IconoEntrega },
  { valor: 'actividad', titulo: 'Actividad', detalle: 'Personal · fecha y horario', Icono: IconoActividad },
]

export default function SelectorTipo({ valor, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">¿Qué quieres agregar?</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPCIONES.map(({ valor: v, titulo, detalle, Icono }) => (
          <label
            key={v}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-4 text-center focus-within:ring-2 focus-within:ring-indigo-500/40 ${
              valor === v
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900'
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={v}
              checked={valor === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            <Icono />
            <span className="font-semibold">{titulo}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{detalle}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
