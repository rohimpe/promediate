import { COLOR_JUSTIFICADA } from '../../lib/calendario'
import {
  diasEnMes,
  diaSemana,
  formatearDiaLargo,
  inicioMes,
  inicioSemana,
  nombreDiaCorto,
  sumarDias,
} from '../../lib/fechas'

const MAX_PUNTOS = 4

// Cuadrícula del mes (semanas de lunes a domingo). Cada día muestra puntos de color,
// uno por evento (los hechos se ven tenues), y "+N" si hay más de los que caben.
//   fecha:       cualquier día del mes a mostrar
//   alDia(dia):  se llama al tocar un día
//   onCrear({ fecha }): opcional; si se pasa, cada casilla tiene un "+" que lo llama
export default function VistaMes({ fecha, eventosPorDia, hoy, alDia, onCrear }) {
  const primero = inicioMes(fecha)
  const semanas = Math.ceil((diaSemana(primero) + diasEnMes(fecha)) / 7)
  const desde = inicioSemana(primero)
  const dias = Array.from({ length: semanas * 7 }, (_, i) => sumarDias(desde, i))
  const mes = primero.slice(0, 7)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {dias.slice(0, 7).map((d) => (
          <span key={d} className="py-2 text-center text-xs text-gray-600 uppercase dark:text-gray-400">
            {nombreDiaCorto(d)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const eventos = eventosPorDia.get(dia) ?? []
          const fueraDelMes = !dia.startsWith(mes)
          const esHoy = dia === hoy
          return (
            // El "+" no puede ir dentro del botón del día (no se anidan botones): se coloca encima, en la esquina.
            <div key={dia} className="relative">
              <button
                type="button"
                onClick={() => alDia(dia)}
                aria-label={`${Number(dia.slice(8))}: ${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`}
                className={`flex h-16 w-full flex-col items-center gap-1 border-t border-l border-gray-200 p-1 hover:bg-gray-50 sm:h-20 dark:border-gray-800 dark:hover:bg-gray-900 ${
                  fueraDelMes ? 'text-gray-400 dark:text-gray-600' : ''
                }`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-sm ${
                    esHoy ? 'bg-indigo-600 font-semibold text-white' : ''
                  }`}
                >
                  {Number(dia.slice(8))}
                </span>
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {eventos.slice(0, MAX_PUNTOS).map((e) => (
                    <span
                      key={e.id}
                      className={`size-2 rounded-full ${e.estado === 'vencida' ? 'ring-2 ring-red-500' : ''} ${
                        e.estado === 'completada' || e.estado === 'justificada' ? 'opacity-40' : ''
                      }`}
                      style={{ backgroundColor: e.estado === 'justificada' ? COLOR_JUSTIFICADA : e.color }}
                    />
                  ))}
                  {eventos.length > MAX_PUNTOS && (
                    <span className="text-[10px] leading-none text-gray-600 dark:text-gray-400">
                      +{eventos.length - MAX_PUNTOS}
                    </span>
                  )}
                </span>
              </button>
              {onCrear && (
                <button
                  type="button"
                  onClick={() => onCrear({ fecha: dia })}
                  aria-label={`Nuevo pendiente: ${formatearDiaLargo(dia)}`}
                  className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full text-sm leading-none text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 dark:text-gray-400 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                >
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
