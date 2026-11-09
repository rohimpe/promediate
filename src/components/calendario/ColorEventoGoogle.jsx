import { useId, useState } from 'react'
import { PALETA_GOOGLE } from '../../lib/calendario'
import { alcanceDeColor, colorIdPropio, coloresGuardados } from '../../lib/seguimiento'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'
const BOTON_PRINCIPAL =
  'rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60'

// Título para los botones: si es largo se corta para que quepa en el celular.
function corto(titulo, max = 24) {
  const t = titulo.trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

// Selector del color de un evento de Google dentro de su panel. Google no devuelve los colores personalizados,
// así que el color se elige aquí y se guarda en la app (google_colores).
//   evento:       evento del calendario (origen 'google'); trae googleId, serieId y colorId (el de Google)
//   seguimiento:  lo que devuelve useSeguimientoGoogle() (reglas, cambiarColor, quitarColor)
//
// Flujo: tocar un color solo lo deja como vista previa (resaltado, sin guardar). Después se elige dónde guardarlo:
// "Solo este evento" o "Todos los '<título>'" (los dos botones están deshabilitados sin vista previa).
// Si ya hay colores guardados, cada uno se quita con su propio botón (visible solo si existe esa fila).
//
// La línea de estado dice de dónde sale el color que se ve. Ya no se crean colores por serie, pero las filas
// antiguas se respetan: "Esta serie usa este color" y su botón para quitarla.
export default function ColorEventoGoogle({ evento, seguimiento }) {
  const uid = useId()
  const [vista, setVista] = useState(null) // colorId en vista previa, o null
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const guardado = coloresGuardados(evento, seguimiento.reglas)
  const propio = colorIdPropio(evento, seguimiento.reglas)
  // Marcado en la paleta: la vista previa; si no, el color guardado; si no, el de Google. Con el azul por
  // defecto (sin colorId) no se marca ninguno.
  const marcado = vista ?? propio ?? evento.colorId ?? null
  const puedePorTitulo = alcanceDeColor(evento, 'titulo') === 'titulo'
  const titulo = corto(evento.titulo)

  let estado
  if (guardado.evento) estado = 'Este evento tiene color propio'
  else if (guardado.serie) estado = 'Esta serie usa este color'
  else if (guardado.titulo) estado = `Todos los “${titulo}” usan este color`
  else if (evento.colorId) estado = 'Usa el color de Google'
  else estado = 'Color por defecto'

  async function ejecutar(accion) {
    setError('')
    setOcupado(true)
    try {
      await accion()
      return true
    } catch {
      setError('No se pudo guardar el color. Inténtalo de nuevo.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function guardar(alcance) {
    if (!vista) return
    if (await ejecutar(() => seguimiento.cambiarColor(evento, vista, alcance))) setVista(null)
  }

  const quitar = (alcance) => ejecutar(() => seguimiento.quitarColor(evento, alcance))

  const quitarBotones = [
    guardado.evento && { alcance: 'evento', texto: 'Quitar color de este evento' },
    guardado.titulo && { alcance: 'titulo', texto: `Quitar color de todos los “${titulo}”` },
    guardado.serie && { alcance: 'serie', texto: 'Quitar color de esta serie' },
  ].filter(Boolean)

  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      {/* Colores como radio buttons ocultos: accesibles con teclado (igual que el color de un curso) */}
      <fieldset disabled={ocupado} className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {PALETA_GOOGLE.map((c) => (
            <label key={c.colorId} className="cursor-pointer">
              {/* onClick además de onChange: así también se puede volver a elegir el color que ya está marcado */}
              <input
                type="radio"
                name={`${uid}-color`}
                value={c.colorId}
                checked={marcado === c.colorId}
                onChange={() => setVista(c.colorId)}
                onClick={() => setVista(c.colorId)}
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

        <p className="text-sm text-gray-600 dark:text-gray-400">{estado}</p>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={ocupado || !vista} onClick={() => guardar('evento')} className={BOTON_PRINCIPAL}>
            Solo este evento
          </button>
          {puedePorTitulo && (
            <button
              type="button"
              disabled={ocupado || !vista}
              onClick={() => guardar('titulo')}
              title={`Todos los “${evento.titulo.trim()}”`}
              className={BOTON_PRINCIPAL}
            >
              Todos los “{titulo}”
            </button>
          )}
        </div>
      </fieldset>

      {quitarBotones.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {quitarBotones.map((b) => (
            <button
              key={b.alcance}
              type="button"
              disabled={ocupado}
              onClick={() => quitar(b.alcance)}
              title={b.alcance === 'titulo' ? `Quitar color de todos los “${evento.titulo.trim()}”` : undefined}
              className={BOTON}
            >
              {b.texto}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
