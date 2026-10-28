import { useCallback, useEffect, useRef, useState } from 'react'
import PendienteForm from './PendienteForm'

// Modal "Nuevo pendiente" con el formulario adentro. Es un <dialog> nativo (como el resumen del
// día): el navegador maneja el fondo oscuro, el foco y la tecla Esc.
//   Celular: hoja que sube desde abajo.  Computadora (sm): ventana centrada.
//
// Quien lo usa lo monta solo cuando está abierto: `{nuevo && <NuevoPendienteModal … />}`.
// Así cada vez que se abre, el formulario empieza de cero con sus valores iniciales.
//
//   valoresIniciales: ver PendienteForm
//   onGuardar:        (campos) => Promise; el `crear` de useTasks
//   onCerrar:         se llama al cerrar, ya sea por guardar o por cancelar
//
// Se cierra con la X, Esc, "Cancelar" o tocando afuera. Si ya se escribió algo, antes pide confirmación.
export default function NuevoPendienteModal({ valoresIniciales, onGuardar, onCerrar }) {
  const dialogRef = useRef(null)
  const estado = useRef({ sucio: false, enviando: false }) // lo que reporta el formulario
  const [confirmando, setConfirmando] = useState(false)
  const apretoAfuera = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const alCambiarEstado = useCallback((nuevo) => {
    estado.current = nuevo
  }, [])

  function intentarCerrar() {
    if (estado.current.enviando) return // mientras guarda no se puede cerrar: perderíamos el error si falla
    if (estado.current.sucio) setConfirmando(true)
    else onCerrar()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="nuevo-pendiente-titulo"
      // Esc: en vez de cerrar directo, pasa por intentarCerrar (que puede pedir confirmación).
      onCancel={(e) => {
        e.preventDefault()
        if (confirmando) setConfirmando(false)
        else intentarCerrar()
      }}
      // Si el navegador cierra el diálogo por su cuenta (p. ej. Esc dos veces seguidas), nos vamos.
      onClose={onCerrar}
      // Clic afuera = clic sobre el propio <dialog> (el fondo). Se exige que también el botón se haya
      // apretado afuera, para que soltar el mouse fuera tras seleccionar texto no cierre el modal.
      onMouseDown={(e) => {
        apretoAfuera.current = e.target === dialogRef.current
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && apretoAfuera.current) intentarCerrar()
      }}
      // Celular: pegado abajo y a todo el ancho. sm: centrado.
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-2xl border border-gray-200 bg-white p-0 text-gray-900 backdrop:bg-black/50 motion-safe:animate-[subir-hoja_0.2s_ease-out] sm:m-auto sm:max-w-lg sm:rounded-2xl sm:motion-safe:animate-[aparecer-ventana_0.15s_ease-out] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="relative flex max-h-[92svh] flex-col">
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 sm:hidden dark:bg-gray-700" />
        {/* inert: mientras se pide confirmación, lo de atrás no recibe foco ni toques */}
        <div inert={confirmando} className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 id="nuevo-pendiente-titulo" className="text-lg font-bold">
            Nuevo pendiente
          </h2>
          <button
            type="button"
            onClick={intentarCerrar}
            aria-label="Cerrar"
            className="flex size-9 items-center justify-center rounded-lg text-xl leading-none hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <div inert={confirmando} className="overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <PendienteForm
            valoresIniciales={valoresIniciales}
            onGuardar={onGuardar}
            onGuardado={onCerrar}
            onCancelar={intentarCerrar}
            onEstado={alCambiarEstado}
          />
        </div>

        {confirmando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-4 dark:bg-gray-900/90">
            <div role="alertdialog" aria-labelledby="descartar-titulo" className="w-full max-w-xs text-center">
              <p id="descartar-titulo" className="font-semibold">
                ¿Descartar lo que escribiste?
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Si cierras ahora, se pierde este pendiente.</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmando(false)}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
