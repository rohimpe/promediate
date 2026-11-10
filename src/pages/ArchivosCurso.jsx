import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import AvisoDrive from '../components/archivos/AvisoDrive'
import BotonSubir from '../components/archivos/BotonSubir'
import ListaArchivos from '../components/archivos/ListaArchivos'
import ProgresoSubidas from '../components/archivos/ProgresoSubidas'
import { useEstadoDrive, useSubidas } from '../hooks/useSubidas'
import { enlaceCarpetaDrive } from '../lib/archivos'
import { listarArchivos, obtenerCursoConCarpeta } from '../lib/archivosApi'

// Archivos de un curso: la lista (de la base, sin consultar Drive) y "Subir archivo" con progreso por archivo.
export default function ArchivosCurso() {
  const { id } = useParams()
  const drive = useEstadoDrive()
  const [curso, setCurso] = useState(null)
  const [archivos, setArchivos] = useState([])
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'no-encontrado' | 'error'

  useEffect(() => {
    let activo = true
    Promise.all([obtenerCursoConCarpeta(id), listarArchivos({ cursoId: id })])
      .then(([c, lista]) => {
        if (!activo) return
        setCurso(c)
        setArchivos(lista)
        setEstado(c ? 'listo' : 'no-encontrado')
      })
      .catch(() => activo && setEstado('error'))
    return () => {
      activo = false
    }
  }, [id])

  const onSubido = useCallback(
    (fila) => {
      setArchivos((actuales) => [fila, ...actuales])
      // La primera subida crea la carpeta (o la vuelve a crear): se lee su id para "Abrir carpeta en Drive".
      obtenerCursoConCarpeta(id)
        .then((c) => c && setCurso(c))
        .catch(() => {})
    },
    [id],
  )
  const { subidas, agregar, limpiar } = useSubidas({ onSubido, onFallo: drive.bloquear })

  if (estado === 'cargando') return <p className="text-gray-600 dark:text-gray-400">Cargando…</p>

  if (estado !== 'listo') {
    return (
      <>
        <p className="text-gray-600 dark:text-gray-400">
          {estado === 'error' ? 'No se pudieron cargar los archivos.' : 'Ese curso no existe.'}
        </p>
        <Link to="/archivos" className="mt-2 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Volver a Archivos
        </Link>
      </>
    )
  }

  const puedeSubir = !drive.cargando && !drive.estadoGoogle

  return (
    <>
      <Link to="/archivos" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        ← Archivos
      </Link>
      <h1 className="mt-1 mb-4 flex items-center gap-2 text-2xl font-bold">
        <span
          className="size-4 shrink-0 rounded-full bg-gray-400"
          style={curso.color ? { backgroundColor: curso.color } : undefined}
        />
        <span className="min-w-0 break-words">{curso.nombre}</span>
      </h1>

      <AvisoDrive estado={drive.estadoGoogle} />

      <div className="mb-4 flex flex-wrap gap-2">
        {puedeSubir && <BotonSubir onElegir={(lista) => agregar(lista, { cursoId: curso.id })} />}
        {curso.drive_folder_id && (
          <a
            href={enlaceCarpetaDrive(curso.drive_folder_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Abrir carpeta en Drive
          </a>
        )}
      </div>
      {puedeSubir && (
        <p className="-mt-2 mb-4 text-xs text-gray-600 dark:text-gray-400">
          Máximo 25 MB por archivo. No se permiten programas ni scripts (.exe, .bat, .js…).
        </p>
      )}

      <ProgresoSubidas subidas={subidas} limpiar={limpiar} />

      <section className="rounded-xl border border-gray-200 bg-white px-4 py-1 dark:border-gray-800 dark:bg-gray-900">
        {archivos.length === 0 ? (
          <p className="py-3 text-sm text-gray-600 dark:text-gray-400">Este curso aún no tiene archivos.</p>
        ) : (
          <ListaArchivos
            archivos={archivos}
            onQuitado={(idArchivo) => setArchivos((actuales) => actuales.filter((a) => a.id !== idArchivo))}
            onFallo={drive.bloquear}
          />
        )}
      </section>
    </>
  )
}
