import { useId, useState } from 'react'
import { PALETA_GOOGLE } from '../../lib/calendario'
import { colorIdPropio } from '../../lib/seguimiento'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Selector del color de un evento de Google dentro de su panel. Google no devuelve los colores personalizados,
// así que el color se elige aquí y se guarda en la app (google_colores). Elegir uno lo guarda al instante.
//   evento:       evento del calendario (origen 'google'); trae googleId y serieId
//   seguimiento:  lo que devuelve useSeguimientoGoogle() (reglas, cambiarColor, restablecerColor)
//
// Si el evento es de una serie, se pregunta si el color es "solo este evento" o "toda la serie" (por defecto,
// toda la serie). "Restablecer" borra el color propio y el evento vuelve al de Google.
export default function ColorEventoGoogle({ evento, seguimiento }) {
  const uid = useId()
  const { reglas } = seguimiento
  const [alcance, setAlcance] = useState(evento.serieId ? 'serie' : 'evento')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const propioDeEvento = reglas.coloresEventos.has(evento.googleId)
  const propioDeSerie = !!evento.serieId && reglas.coloresSeries.has(evento.serieId)
  const elegido = colorIdPropio(evento, reglas)
  // Restablecer "toda la serie" también quita el color propio de esta ocurrencia; "solo este evento", solo ese.
  const hayQueRestablecer = alcance === 'serie' ? propioDeEvento || propioDeSerie : propioDeEvento

  async function ejecutar(accion) {
    setError('')
    setOcupado(true)
    try {
      await accion()
    } catch {
      setError('No se pudo guardar el color. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  let nota = 'Usa el color de Google.'
  if (propioDeEvento) nota = 'Este evento tiene un color propio.'
  else if (propioDeSerie) nota = 'Toda la serie usa este color.'

  return (
    <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
      {/* Colores como radio buttons ocultos: accesibles con teclado (igual que el color de un curso) */}
      <fieldset disabled={ocupado} className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {PALETA_GOOGLE.map((c) => (
            <label key={c.colorId} className="cursor-pointer">
              <input
                type="radio"
                name={`${uid}-color`}
                value={c.colorId}
                checked={elegido === c.colorId}
                onChange={() => ejecutar(() => seguimiento.cambiarColor(evento, c.colorId, alcance))}
                className="peer sr-only"
              />
              <span
                title={c.nombre}
                style={{ backgroundColor: c.valor }}
                className="block size-7 rounded-full ring-offset-2 ring-offset-white peer-checked:ring-2 peer-checked:ring-gray-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-disabled:opacity-60 dark:ring-offset-gray-900 dark:peer-checked:ring-gray-100"
              />
              <span className="sr-only">{c.nombre}</span>
            </label>
          ))}
        </div>

        {evento.serieId && (
          <div role="radiogroup" aria-label="¿Solo este evento o toda la serie?" className="space-y-1 text-sm">
            <p className="font-medium">¿Solo este evento o toda la serie?</p>
            {[
              { valor: 'serie', texto: 'Toda la serie' },
              { valor: 'evento', texto: 'Solo este evento' },
            ].map((o) => (
              <label key={o.valor} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`${uid}-alcance`}
                  value={o.valor}
                  checked={alcance === o.valor}
                  onChange={() => setAlcance(o.valor)}
                  className="size-4 accent-indigo-600"
                />
                {o.texto}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          disabled={ocupado || !hayQueRestablecer}
          onClick={() => ejecutar(() => seguimiento.restablecerColor(evento, alcance))}
          className={BOTON}
        >
          Restablecer
        </button>
        <p className="text-sm text-gray-600 dark:text-gray-400">{nota}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
