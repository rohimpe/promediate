import { useRef } from 'react'

// Botón que abre el selector de archivos del sistema (permite elegir varios).
//   onElegir(archivos): un array de File
export default function BotonSubir({ texto = 'Subir archivo', onElegir, disabled = false, className = '' }) {
  const input = useRef(null)

  function elegir(e) {
    const archivos = [...e.target.files]
    e.target.value = '' // así se puede volver a elegir el mismo archivo
    if (archivos.length > 0) onElegir(archivos)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        className={`rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 ${className}`}
      >
        {texto}
      </button>
      <input ref={input} type="file" multiple hidden onChange={elegir} />
    </>
  )
}
