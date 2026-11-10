const TEXTO_ESTADO = {
  espera: 'En espera…',
  subiendo: 'Subiendo…',
  registrando: 'Guardando…',
  listo: 'Subido ✓',
}

// Una barra de progreso por archivo, con su error si falló. `subidas` y `limpiar` vienen de useSubidas.
export default function ProgresoSubidas({ subidas, limpiar }) {
  if (subidas.length === 0) return null
  const terminadas = subidas.some((s) => s.estado === 'listo' || s.estado === 'error')

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <ul className="space-y-3">
        {subidas.map((s) => (
          <li key={s.clave}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium break-words">{s.nombre}</span>
              {s.estado !== 'error' && (
                <span className="shrink-0 text-xs text-gray-600 dark:text-gray-400">
                  {s.estado === 'subiendo' ? `${Math.round(s.progreso * 100)}%` : TEXTO_ESTADO[s.estado]}
                </span>
              )}
            </div>
            {s.estado === 'error' ? (
              <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {s.error}
              </p>
            ) : (
              <div
                role="progressbar"
                aria-label={`Progreso de ${s.nombre}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(s.progreso * 100)}
                className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
              >
                <div
                  className={`h-full transition-[width] ${s.estado === 'listo' ? 'bg-green-600' : 'bg-indigo-600'}`}
                  style={{ width: `${s.progreso * 100}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {terminadas && (
        <button
          type="button"
          onClick={limpiar}
          className="mt-3 text-xs font-medium text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          Ocultar terminadas
        </button>
      )}
    </div>
  )
}
