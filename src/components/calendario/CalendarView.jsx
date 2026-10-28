import { useMemo, useRef, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { agruparPorDia } from '../../lib/calendario'
import {
  formatearDiaLargo,
  formatearMesAnio,
  formatearRango,
  hoyEnLima,
  inicioSemana,
  sumarDias,
  sumarMeses,
} from '../../lib/fechas'
import VistaHoras from './VistaHoras'
import VistaMes from './VistaMes'

const NOMBRE_VISTA = { dia: 'Día', semana: 'Semana', mes: 'Mes' }

// Calendario reutilizable. Solo conoce eventos normalizados (ver src/lib/calendario.js),
// así que sirve igual para los pendientes de la app y, más adelante, para Google Calendar.
//
//   eventos:        lista de eventos normalizados
//   onSeleccionar:  (evento) => … al tocar un evento
//   vistas:         vistas disponibles, p. ej. ['mes'] para una versión compacta
//   vistaInicial:   'dia' | 'semana' | 'mes'
//   alturaMaxima:   alto máximo (px) del área con scroll de las vistas por horas
//   onElegirDia:    (fecha) => … al tocar un día del mes; se usa si 'dia' no está en `vistas`
//                   (si está, tocar un día abre la vista de ese día)
//   onCrear:        (valores) => … para crear un pendiente desde el calendario. `valores` son los
//                   valores iniciales de <PendienteForm> ({ fecha, tipo, horaInicio, … }). Si no se
//                   pasa, el calendario es solo de lectura (sin botón "+ Nuevo" ni toques para crear).
export default function CalendarView({
  eventos,
  onSeleccionar,
  vistas = ['dia', 'semana', 'mes'],
  vistaInicial = 'semana',
  alturaMaxima = 640,
  onElegirDia,
  onCrear,
}) {
  const hoy = hoyEnLima()
  const ancha = useMediaQuery('(min-width: 640px)')
  const [vista, setVista] = useState(vistas.includes(vistaInicial) ? vistaInicial : vistas[0])
  const [fecha, setFecha] = useState(hoy)
  const toque = useRef(null)

  const eventosPorDia = useMemo(() => agruparPorDia(eventos), [eventos])

  // En celular no cabe una semana: la vista "semana" se muestra como un solo día.
  const vistaActual = vista === 'semana' && !ancha && vistas.includes('dia') ? 'dia' : vista
  const botones = vistas.filter((v) => ancha || v !== 'semana' || !vistas.includes('dia'))

  function mover(direccion) {
    if (vistaActual === 'mes') setFecha((f) => sumarMeses(f, direccion))
    else setFecha((f) => sumarDias(f, (vistaActual === 'semana' ? 7 : 1) * direccion))
  }

  function elegirDia(dia) {
    if (vistas.includes('dia')) {
      setFecha(dia)
      setVista('dia')
    } else {
      onElegirDia?.(dia)
    }
  }

  // Deslizar el dedo a los lados cambia de día (solo cuenta si el gesto es sobre todo horizontal).
  function alTocar(e) {
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function alSoltar(e) {
    const ini = toque.current
    toque.current = null
    if (!ini) return
    const dx = e.changedTouches[0].clientX - ini.x
    const dy = e.changedTouches[0].clientY - ini.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) mover(dx < 0 ? 1 : -1)
  }

  let titulo
  let dias
  if (vistaActual === 'mes') {
    titulo = formatearMesAnio(fecha)
  } else if (vistaActual === 'semana') {
    const lunes = inicioSemana(fecha)
    dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
    titulo = formatearRango(dias[0], dias[6])
  } else {
    dias = [fecha]
    titulo = formatearDiaLargo(fecha)
  }

  const boton =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => mover(-1)} className={boton}>
            Anterior
          </button>
          <button type="button" onClick={() => setFecha(hoy)} className={boton}>
            Hoy
          </button>
          <button type="button" onClick={() => mover(1)} className={boton}>
            Siguiente
          </button>
        </div>

        <div className="flex items-center gap-2">
          {botones.length > 1 && (
            <div role="group" aria-label="Vista" className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
              {botones.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={v === vistaActual}
                  onClick={() => setVista(v)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    v === vistaActual
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {NOMBRE_VISTA[v]}
                </button>
              ))}
            </div>
          )}

          {onCrear && (
            <button
              type="button"
              onClick={() => onCrear({ fecha: hoy })}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold capitalize">{titulo}</h2>

      <div onTouchStart={alTocar} onTouchEnd={alSoltar}>
        {vistaActual === 'mes' ? (
          <VistaMes fecha={fecha} eventosPorDia={eventosPorDia} hoy={hoy} alDia={elegirDia} onCrear={onCrear} />
        ) : (
          // key: al pasar de día a semana (o al revés) se vuelve a montar y reposiciona el scroll.
          <VistaHoras
            key={vistaActual}
            dias={dias}
            eventosPorDia={eventosPorDia}
            hoy={hoy}
            onSeleccionar={onSeleccionar}
            alDia={vistaActual === 'semana' ? elegirDia : undefined}
            onCrear={onCrear}
            alturaMaxima={alturaMaxima}
          />
        )}
      </div>
    </div>
  )
}
