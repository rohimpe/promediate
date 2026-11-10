import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import AvisoDrive from '../components/archivos/AvisoDrive'
import ListaArchivos from '../components/archivos/ListaArchivos'
import EstadoVacio from '../components/inicio/EstadoVacio'
import { useEstadoDrive } from '../hooks/useSubidas'
import { contarArchivos, contarCarpetas, enlaceCarpetaDrive } from '../lib/archivos'
import { listarArchivos, listarCursosConArchivos } from '../lib/archivosApi'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

// Página "Archivos": una carpeta (tarjeta) por curso, con cuántos archivos tiene y su carpeta en Drive.
// Abajo, los archivos que quedaron sin curso (porque se borró el curso; siguen en Drive).
export default function Archivos() {
  const drive = useEstadoDrive()
  const [cursos, setCursos] = useState([])
  const [sinCurso, setSinCurso] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([listarCursosConArchivos(), listarArchivos({ sinCurso: true })])
      .then(([listaCursos, huerfanos]) => {
        if (!activo) return
        setCursos(listaCursos)
        setSinCurso(huerfanos)
      })
      .catch(() => activo && setError('No se pudieron cargar tus carpetas.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Archivos</h1>

      <AvisoDrive estado={drive.estadoGoogle} />

      {cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!cargando && !error && cursos.length === 0 && (
        <EstadoVacio mensaje="Agrega tu primer curso: cada curso tiene su carpeta." textoBoton="Ir a Promedios" to="/promedios" />
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {cursos.map((c) => {
          const n = contarArchivos(c)
          const nCarpetas = contarCarpetas(c)
          return (
            <li
              key={c.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <Link to={`/archivos/${c.id}`} className="flex items-center gap-3 hover:underline">
                <span aria-hidden="true" className="text-xl">
                  📁
                </span>
                <span
                  className="size-3 shrink-0 rounded-full bg-gray-400"
                  style={c.color ? { backgroundColor: c.color } : undefined}
                />
                <span className="min-w-0 font-semibold break-words">{c.nombre}</span>
              </Link>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {n === 0 ? 'Sin archivos' : `${n} ${n === 1 ? 'archivo' : 'archivos'}`}
                {nCarpetas > 0 && ` · ${nCarpetas} ${nCarpetas === 1 ? 'carpeta' : 'carpetas'}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/archivos/${c.id}`} className={BOTON}>
                  Ver archivos
                </Link>
                {c.drive_folder_id && (
                  <a href={enlaceCarpetaDrive(c.drive_folder_id)} target="_blank" rel="noopener noreferrer" className={BOTON}>
                    Abrir carpeta en Drive
                  </a>
                )}
              </div>
              {!c.drive_folder_id && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  La carpeta en Drive se crea al subir el primer archivo o crear la primera carpeta.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {sinCurso.length > 0 && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="font-semibold">Sin curso</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Archivos de cursos que borraste. Siguen en tu Google Drive.
          </p>
          <ListaArchivos
            archivos={sinCurso}
            onQuitado={(id) => setSinCurso((actuales) => actuales.filter((a) => a.id !== id))}
            onFallo={drive.bloquear}
          />
        </section>
      )}
    </>
  )
}
