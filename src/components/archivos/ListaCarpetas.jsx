import { useEffect, useRef, useState } from 'react'
import { MENSAJES_CARPETA, textoContenido, textoElementos } from '../../lib/archivos'
import CampoNombreCarpeta from './CampoNombreCarpeta'

const OPCION =
  'block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800'

// Menú "⋯" de una carpeta con Renombrar y Borrar. Se cierra al elegir, con Esc o tocando fuera.
function MenuCarpeta({ nombre, disabled, onRenombrar, onBorrar }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (!caja.current?.contains(e.target)) setAbierto(false)
    }
    const tecla = (e) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const elegir = (accion) => {
    setAbierto(false)
    accion()
  }

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Opciones de la carpeta ${nombre}`}
        title="Opciones"
        className="flex size-10 items-center justify-center rounded-lg text-xl leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ⋯
      </button>
      {abierto && (
        <div
          role="menu"
          aria-label={`Opciones de la carpeta ${nombre}`}
          className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <button type="button" role="menuitem" autoFocus onClick={() => elegir(onRenombrar)} className={OPCION}>
            Renombrar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => elegir(onBorrar)}
            className={`${OPCION} text-red-700 dark:text-red-400`}
          >
            Borrar
          </button>
        </div>
      )}
    </div>
  )
}

// Una carpeta: nombre y cuántos elementos tiene. Tocarla entra en ella; el menú permite renombrarla o borrarla.
function FilaCarpeta({ carpeta, elementos, contenido, onAbrir, onRenombrar, onBorrar }) {
  const [renombrando, setRenombrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function borrar() {
    const texto = textoContenido(contenido)
    const mensaje =
      `¿Borrar la carpeta "${carpeta.nombre}"? ` +
      (texto ? `Contiene ${texto}. ` : 'Está vacía. ') +
      'Irá a la papelera de tu Google Drive (desde allí se puede recuperar) y desaparecerá de esta lista' +
      (texto ? ' junto con todo su contenido.' : '.')
    if (!window.confirm(mensaje)) return
    setOcupado(true)
    setError('')
    const estado = await onBorrar(carpeta)
    // Si salió bien, la fila desaparece (se desmonta).
    if (estado) {
      setError(MENSAJES_CARPETA[estado] ?? MENSAJES_CARPETA.error)
      setOcupado(false)
    }
  }

  if (renombrando) {
    return (
      <li className="py-3">
        <CampoNombreCarpeta
          inicial={carpeta.nombre}
          etiqueta="Nuevo nombre de la carpeta"
          textoConfirmar="Renombrar"
          onCancelar={() => setRenombrando(false)}
          onConfirmar={async (nombre) => {
            const estado = await onRenombrar(carpeta, nombre)
            if (!estado) setRenombrando(false)
            return estado
          }}
        />
      </li>
    )
  }

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAbrir(carpeta.id)}
          disabled={ocupado}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-gray-800/60"
        >
          <span aria-hidden="true" className="text-xl">
            📁
          </span>
          <span className="min-w-0">
            <span className="block font-medium break-words">{carpeta.nombre}</span>
            <span className="block text-xs text-gray-600 dark:text-gray-400">
              {ocupado ? 'Borrando…' : textoElementos(elementos)}
            </span>
          </span>
        </button>
        <MenuCarpeta
          nombre={carpeta.nombre}
          disabled={ocupado}
          onRenombrar={() => {
            setError('')
            setRenombrando(true)
          }}
          onBorrar={borrar}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  )
}

// Carpetas de un nivel (las que están directamente en la carpeta actual).
//   carpetas: [{ carpeta, elementos, contenido }]  elementos = directos; contenido = { subcarpetas, archivos } total
//   onAbrir(id): entrar en la carpeta
//   onRenombrar(carpeta, nombre) / onBorrar(carpeta): async; devuelven null si salió bien o el estado del error
export default function ListaCarpetas({ carpetas, onAbrir, onRenombrar, onBorrar }) {
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
      {carpetas.map(({ carpeta, elementos, contenido }) => (
        <FilaCarpeta
          key={carpeta.id}
          carpeta={carpeta}
          elementos={elementos}
          contenido={contenido}
          onAbrir={onAbrir}
          onRenombrar={onRenombrar}
          onBorrar={onBorrar}
        />
      ))}
    </ul>
  )
}
