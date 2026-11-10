import { useState } from 'react'
import { formatearTamano, MENSAJES_ARCHIVO, tipoLegible } from '../../lib/archivos'
import { borrarArchivo, quitarDeLista } from '../../lib/archivosApi'
import { formatearFechaHora } from '../../lib/fechas'

const MENSAJES_BORRAR = {
  ...MENSAJES_ARCHIVO,
  error: 'No se pudo borrar de Google Drive. Inténtalo de nuevo, o usa «Quitar de la lista» si ya lo borraste allí.',
}

// Un archivo: nombre, tipo, tamaño, fecha, "Abrir en Drive", "Borrar" y "Quitar de la lista".
function FilaArchivo({ archivo, compacto, onQuitado, onFallo }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function borrar() {
    if (!window.confirm(`¿Borrar "${archivo.nombre}"? Se eliminará también de tu Google Drive.`)) return
    setOcupado(true)
    setError('')
    const { estado } = await borrarArchivo(archivo.id)
    if (estado === 'ok') return onQuitado(archivo.id) // la fila desaparece de la lista
    setError(MENSAJES_BORRAR[estado] ?? MENSAJES_BORRAR.error)
    onFallo?.(estado)
    setOcupado(false)
  }

  // Para archivos que el usuario borró directamente en Drive: solo se borra la fila.
  async function quitar() {
    if (!window.confirm(`¿Quitar "${archivo.nombre}" de la lista? No se borra de tu Google Drive (si aún existe).`)) {
      return
    }
    setOcupado(true)
    setError('')
    try {
      await quitarDeLista(archivo.id)
      onQuitado(archivo.id)
    } catch {
      setError('No se pudo quitar de la lista. Inténtalo de nuevo.')
      setOcupado(false)
    }
  }

  const detalles = [
    tipoLegible(archivo.mime_type, archivo.nombre),
    formatearTamano(archivo.tamano),
    formatearFechaHora(archivo.created_at),
  ].filter(Boolean)

  const boton =
    'rounded-lg border px-3 py-1.5 font-medium disabled:opacity-60 ' + (compacto ? 'text-xs' : 'text-sm')

  return (
    <li className={compacto ? 'py-2' : 'py-3'}>
      <p className={`font-medium break-words ${compacto ? 'text-sm' : ''}`}>{archivo.nombre}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {detalles.join(' · ')}
        {!compacto && archivo.task_id && ' · Adjunto a una entrega'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {archivo.enlace && (
          <a
            href={archivo.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className={`${boton} border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800`}
          >
            Abrir en Drive
          </a>
        )}
        <button
          type="button"
          onClick={borrar}
          disabled={ocupado}
          className={`${boton} border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`}
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={quitar}
          disabled={ocupado}
          title="Si ya lo borraste en Drive, quítalo de aquí sin tocar Drive"
          className={`${boton} border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`}
        >
          Quitar de la lista
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  )
}

// Lista de archivos registrados (de un curso, de una entrega o sin curso). No consulta Drive: si un archivo se
// borró allí, su enlace llevará a un error de Google y se puede limpiar con "Quitar de la lista".
//   onQuitado(id): el archivo ya no está en la base (borrado o quitado)
//   onFallo(estado): el borrado en Drive falló con ese estado (p. ej. 'reconectar')
//   compacto: letra más pequeña (para el panel de una entrega)
export default function ListaArchivos({ archivos, onQuitado, onFallo, compacto = false }) {
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
      {archivos.map((a) => (
        <FilaArchivo key={a.id} archivo={a} compacto={compacto} onQuitado={onQuitado} onFallo={onFallo} />
      ))}
    </ul>
  )
}
