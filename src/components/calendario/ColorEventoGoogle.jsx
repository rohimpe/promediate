import { useId, useState } from 'react'
import { PALETA_GOOGLE } from '../../lib/calendario'
import { alcanceDeColor, colorIdPropio, coloresGuardados } from '../../lib/seguimiento'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Selector del color de un evento de Google dentro de su panel. Google no devuelve los colores personalizados,
// así que el color se elige aquí y se guarda en la app (google_colores). Elegir uno lo guarda al instante.
//   evento:       evento del calendario (origen 'google'); trae googleId y serieId
//   seguimiento:  lo que devuelve useSeguimientoGoogle() (reglas, cambiarColor, restablecerColor)
//
// Se pregunta a qué se aplica el color: "Solo este evento", "Toda la serie" (si es de una serie) y "Todos los
// eventos con este título" (por defecto). "Restablecer" borra el color propio y el evento vuelve al de Google.
//
// Solo se marca un color como elegido, y solo se escribe la nota, si el color viene de uno GUARDADO (google_colores).
// Si el evento se ve con el color de Google o el azul por defecto, no hay nada marcado ni nota y "Restablecer"
// queda deshabilitado.
export default function ColorEventoGoogle({ evento, seguimiento }) {
  const uid = useId()
  const { reglas } = seguimiento
  const [alcance, setAlcance] = useState(() => alcanceDeColor(evento, 'titulo'))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const guardado = coloresGuardados(evento, reglas)
  const elegido = colorIdPropio(evento, reglas)
  // Restablecer quita el color del alcance elegido y los más específicos de este evento (igual que al pintar).
  const hayQueRestablecer =
    alcance === 'titulo'
      ? !!(guardado.evento || guardado.serie || guardado.titulo)
      : alcance === 'serie'
        ? !!(guardado.evento || guardado.serie)
        : !!guardado.evento

  const opciones = [
    { valor: 'evento', texto: 'Solo este evento' },
    ...(alcanceDeColor(evento, 'serie') === 'serie' ? [{ valor: 'serie', texto: 'Toda la serie' }] : []),
    ...(alcanceDeColor(evento, 'titulo') === 'titulo'
      ? [{ valor: 'titulo', texto: 'Todos los eventos con este título' }]
      : []),
  ]

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

  let nota = null
  if (guardado.evento) nota = 'Este evento tiene un color propio.'
  else if (guardado.serie) nota = 'Toda la serie usa este color.'
  else if (guardado.titulo) nota = 'Todos los eventos con este título usan este color.'

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

        {opciones.length > 1 && (
          <div role="radiogroup" aria-label="¿A qué eventos se aplica el color?" className="space-y-1 text-sm">
            <p className="font-medium">¿A qué eventos se aplica el color?</p>
            {opciones.map((o) => (
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
        {nota && <p className="text-sm text-gray-600 dark:text-gray-400">{nota}</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
