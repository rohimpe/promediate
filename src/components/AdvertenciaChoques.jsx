import { useEffect, useRef } from 'react'
import { horarioDeElemento } from '../lib/choques'
import { IconoGoogle } from './calendario/BloqueEvento'
import { IconoActividad } from './IconosTipo'

// Triángulo de advertencia (también lo usan los bloques del calendario).
export function IconoAdvertencia({ className = 'size-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 ${className}`}>
      <path d="M8 2 1.5 13.5h13L8 2Z" strokeLinejoin="round" />
      <path d="M8 6.5v3M8 11.5v.01" strokeLinecap="round" />
    </svg>
  )
}

// Lista de lo que se cruza: título y horario de cada elemento.
export function ListaChoques({ choques }) {
  return (
    <ul className="space-y-1 text-sm">
      {choques.map((e) => (
        <li key={e.id} className="flex items-start gap-1.5">
          {e.origen === 'google' ? <IconoGoogle className="mt-0.5 size-3.5" /> : <IconoActividad className="mt-0.5 size-3.5" />}
          <span className="min-w-0 break-words">
            <span className="font-medium">{e.titulo}</span> · {horarioDeElemento(e)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Advertencia NO bloqueante de choque de horario, para mostrarla antes de guardar.
//   choques:    elementos que se solapan (ver buscarChoques)
//   onGuardar:  "Guardar de todos modos"
//   onCambiar:  "Cambiar hora"
//   ocupado:    deshabilita los botones mientras se guarda
export default function AdvertenciaChoques({ choques, onGuardar, onCambiar, ocupado = false }) {
  const ref = useRef(null)

  // Al aparecer, se asegura de que se vea (el formulario puede ser más alto que la pantalla).
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  return (
    <div
      ref={ref}
      role="alert"
      className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <IconoAdvertencia />
        {choques.length === 1 ? 'Esta hora se cruza con otro evento' : `Esta hora se cruza con ${choques.length} eventos`}
      </p>
      <ListaChoques choques={choques} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={onGuardar}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {ocupado ? 'Guardando…' : 'Guardar de todos modos'}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={onCambiar}
          className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:hover:bg-amber-900"
        >
          Cambiar hora
        </button>
      </div>
    </div>
  )
}
