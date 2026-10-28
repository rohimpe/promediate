import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { dividirChecklist } from '../lib/checklist'
import { formatearDiaLargo, hoyEnLima } from '../lib/fechas'
import { prioridadActual } from '../lib/priority'
import { obtenerUltimoResumen, guardarUltimoResumen } from '../lib/profileApi'
import { listarTareas } from '../lib/tasksApi'
import { NOMBRE_TIPO, horarioTarea } from '../lib/tipos'
import EtiquetaPrioridad from './EtiquetaPrioridad'

// Modal de bienvenida: aparece la primera vez que se abre la app en el día (hora de Lima).
// "Hoy" se compara con profiles.ultimo_resumen, que vive en la base de datos,
// así que si ya lo viste en el celular no vuelve a salir en la computadora.
export default function ResumenDelDia() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [resumen, setResumen] = useState(null) // null = no mostrar

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let activo = true

    async function cargar() {
      const hoy = hoyEnLima()
      try {
        const ultimo = await obtenerUltimoResumen(userId)
        if (ultimo && ultimo >= hoy) return // ya lo vio hoy ('YYYY-MM-DD' se compara como texto)

        const { hoyPendientes, vencidas } = dividirChecklist(await listarTareas(), hoy)
        if (activo) setResumen({ hoy, pendientes: hoyPendientes, vencidas })
      } catch {
        // Si algo falla simplemente no mostramos el resumen; no es crítico.
      }
    }

    cargar()
    return () => {
      activo = false
    }
  }, [userId])

  // <dialog> nativo: el navegador se encarga del fondo oscuro, la tecla Esc y el foco.
  useEffect(() => {
    const dialog = dialogRef.current
    if (resumen && dialog && !dialog.open) dialog.showModal()
  }, [resumen])

  if (!resumen) return null

  // Se llama al cerrar por cualquier vía (botón, Esc o clic afuera).
  async function alCerrar() {
    const { hoy } = resumen
    setResumen(null)
    try {
      await guardarUltimoResumen(userId, hoy)
    } catch {
      // Si no se pudo guardar, el resumen volverá a salir la próxima vez. No es grave.
    }
  }

  function irAlChecklist() {
    dialogRef.current.close()
    navigate('/hoy')
  }

  const { hoy, pendientes, vencidas } = resumen

  return (
    <dialog
      ref={dialogRef}
      onClose={alCerrar}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      aria-labelledby="resumen-titulo"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="max-h-[80svh] overflow-y-auto p-5">
        <h2 id="resumen-titulo" className="text-xl font-bold">
          Resumen del día
        </h2>
        <p className="text-sm text-gray-600 capitalize dark:text-gray-400">{formatearDiaLargo(hoy)}</p>

        {vencidas.length > 0 && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            Tienes {vencidas.length} {vencidas.length === 1 ? 'pendiente vencido' : 'pendientes vencidos'} sin completar.
          </p>
        )}

        {pendientes.length === 0 ? (
          <p className="mt-4 text-gray-600 dark:text-gray-400">No tienes nada pendiente para hoy. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pendientes.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <div className="min-w-0">
                  <p className="font-medium">{t.titulo}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {NOMBRE_TIPO[t.tipo]}
                    {horarioTarea(t) && ` · ${horarioTarea(t)}`}
                  </p>
                </div>
                <EtiquetaPrioridad prioridad={prioridadActual(t, hoy)} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={irAlChecklist}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            Ir a Hoy
          </button>
          <button
            onClick={() => dialogRef.current.close()}
            className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </dialog>
  )
}
