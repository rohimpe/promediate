import { useEffect, useRef, useState } from 'react'
import { posicionarEventos, valoresDeEncabezado, valoresDeToqueEnHoras } from '../../lib/calendario'
import { formatearDiaLargo, minutosEnLima, nombreDiaCorto } from '../../lib/fechas'
import BloqueEvento from './BloqueEvento'

const PX_POR_HORA = 48
const HORAS = Array.from({ length: 24 }, (_, h) => h)
const ANCHO_HORAS = '3rem' // columna con los números de hora

// Cuadrícula de horas con una columna por día (7 en la semana, 1 en la vista de día).
//   dias:          ['YYYY-MM-DD', …]
//   eventosPorDia: Map de agruparPorDia()
//   alDia(fecha):  opcional; se llama al tocar el número de un día (vista semanal)
//   onCrear(valores): opcional; se llama al tocar un espacio vacío (actividad con esa hora) o el
//                  encabezado (entrega); recibe los valores iniciales de <PendienteForm>
export default function VistaHoras({ dias, eventosPorDia, hoy, onSeleccionar, alDia, onCrear, alturaMaxima }) {
  const scrollRef = useRef(null)
  const [ahora, setAhora] = useState(() => new Date())

  // La línea roja de "ahora" se mueve cada minuto.
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Al abrir, deja a la vista la hora actual (o las 7:00 si no estamos mirando hoy).
  useEffect(() => {
    const minutos = dias.includes(hoy) ? Math.max(minutosEnLima(new Date()) - 60, 0) : 7 * 60
    scrollRef.current.scrollTop = (minutos / 60) * PX_POR_HORA
    // Solo al montar: al cambiar de semana se conserva el scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Para distinguir un toque de un arrastre o un scroll: se anota dónde y con qué scroll empezó
  // el gesto. Al llegar el clic, solo cuenta como toque si casi no se movió y no hubo scroll.
  const gesto = useRef(null)
  function alBajar(e) {
    gesto.current = { x: e.clientX, y: e.clientY, scroll: scrollRef.current.scrollTop }
  }
  function esToque(e) {
    const g = gesto.current
    gesto.current = null
    return !!g && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 8 && scrollRef.current.scrollTop === g.scroll
  }

  // Clic en una columna. Solo cuenta si fue sobre el espacio vacío (no sobre un evento).
  // e.currentTarget es la columna entera (de las 00:00 a las 24:00), así que su borde de arriba
  // ya incluye el scroll: los píxeles desde las 00:00 son simplemente clientY - top.
  function tocarColumna(e, dia) {
    if (!esToque(e) || e.target !== e.currentTarget) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    onCrear(valoresDeToqueEnHoras(dia, y, PX_POR_HORA))
  }

  const columnas = { gridTemplateColumns: `${ANCHO_HORAS} repeat(${dias.length}, minmax(0, 1fr))` }
  const hayTodoElDia = dias.some((d) => eventosPorDia.get(d)?.some((e) => e.todoElDia))

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Encabezado: nombre y número de cada día */}
      <div className="grid border-b border-gray-200 dark:border-gray-800" style={columnas}>
        <div />
        {dias.map((dia) => {
          const esHoy = dia === hoy
          const diaLargo = formatearDiaLargo(dia)
          const clasesNumero = `mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
            esHoy ? 'bg-indigo-600 text-white' : ''
          }`
          // Tocar el encabezado crea una entrega. Si además se puede ir al día (vista semanal),
          // el número es un botón aparte que lo abre; el resto del encabezado sigue creando.
          const accionCelda = onCrear ? () => onCrear(valoresDeEncabezado(dia)) : alDia ? () => alDia(dia) : null
          return (
            <div
              key={dia}
              className={`relative py-2 text-center ${accionCelda ? 'hover:bg-gray-50 dark:hover:bg-gray-900' : ''}`}
            >
              {accionCelda && (
                <button
                  type="button"
                  onClick={accionCelda}
                  aria-label={onCrear ? `Nuevo pendiente: ${diaLargo}` : `Ver el día ${diaLargo}`}
                  className="absolute inset-0"
                />
              )}
              <span className="block text-xs text-gray-600 uppercase dark:text-gray-400">{nombreDiaCorto(dia)}</span>
              {onCrear && alDia ? (
                <button
                  type="button"
                  onClick={() => alDia(dia)}
                  aria-label={`Ver el día ${diaLargo}`}
                  className={`relative z-10 ${clasesNumero} ${esHoy ? '' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                  {Number(dia.slice(8))}
                </button>
              ) : (
                <span className={clasesNumero}>{Number(dia.slice(8))}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Franja "todo el día": actividades sin hora */}
      {hayTodoElDia && (
        <div className="grid border-b border-gray-200 dark:border-gray-800" style={columnas}>
          <div className="px-1 py-1 text-right text-[10px] leading-tight text-gray-500">todo el día</div>
          {dias.map((dia) => (
            <div key={dia} className="min-w-0 space-y-0.5 p-0.5">
              {eventosPorDia
                .get(dia)
                ?.filter((e) => e.todoElDia)
                .map((e) => (
                  <BloqueEvento key={e.id} evento={e} onClick={() => onSeleccionar(e)} className="w-full" />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Cuerpo con scroll: 24 horas */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: alturaMaxima }}>
        <div className="grid" style={{ ...columnas, height: PX_POR_HORA * 24 }} onPointerDown={alBajar}>
          <div className="relative">
            {HORAS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-500"
                style={{ top: h * PX_POR_HORA }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {dias.map((dia) => (
            <div
              key={dia}
              onClick={onCrear ? (e) => tocarColumna(e, dia) : undefined}
              className="relative border-l border-gray-200 [--linea:#e5e7eb] dark:border-gray-800 dark:[--linea:#1f2937]"
              style={{
                backgroundImage: 'linear-gradient(to bottom, var(--linea) 1px, transparent 1px)',
                backgroundSize: `100% ${PX_POR_HORA}px`,
              }}
            >
              {posicionarEventos(eventosPorDia.get(dia) ?? [], PX_POR_HORA).map(
                ({ evento, top, height, columna, columnas: n }) => (
                  <BloqueEvento
                    key={evento.id}
                    evento={evento}
                    detalle={height >= 40}
                    onClick={() => onSeleccionar(evento)}
                    className="absolute"
                    style={{
                      top,
                      height: height - 1,
                      left: `calc(${(columna / n) * 100}% + 1px)`,
                      width: `calc(${100 / n}% - 2px)`,
                    }}
                  />
                ),
              )}

              {dia === hoy && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500"
                  style={{ top: (minutosEnLima(ahora) / 60) * PX_POR_HORA }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
