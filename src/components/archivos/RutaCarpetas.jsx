// Ruta navegable arriba de la lista: Curso / Carpeta / Subcarpeta. Cada parte (menos la última) lleva a esa carpeta.
//   curso: { nombre }
//   ruta:  las carpetas desde la del curso hasta la actual (rutaDeCarpeta); vacía = en la carpeta del curso
//   onIr(id): id de la carpeta, o null para volver a la del curso
export default function RutaCarpetas({ curso, ruta, onIr }) {
  const partes = [{ id: null, nombre: curso.nombre }, ...ruta]

  return (
    <nav aria-label="Ruta de carpetas" className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        {partes.map((parte, i) => {
          const ultima = i === partes.length - 1
          return (
            <li key={parte.id ?? 'curso'} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-gray-400 dark:text-gray-600">
                  /
                </span>
              )}
              {ultima ? (
                <span aria-current="page" className="font-semibold break-all">
                  {parte.nombre}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onIr(parte.id)}
                  className="rounded font-medium break-all text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {parte.nombre}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
