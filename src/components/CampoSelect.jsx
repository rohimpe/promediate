// Lista desplegable con etiqueta, mismo estilo que CampoTexto.
export default function CampoSelect({ label, id, children, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950"
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
