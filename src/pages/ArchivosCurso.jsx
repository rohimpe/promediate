import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import AvisoDrive from '../components/archivos/AvisoDrive'
import BotonSubir from '../components/archivos/BotonSubir'
import CampoNombreCarpeta from '../components/archivos/CampoNombreCarpeta'
import ListaArchivos from '../components/archivos/ListaArchivos'
import ListaCarpetas from '../components/archivos/ListaCarpetas'
import ProgresoSubidas from '../components/archivos/ProgresoSubidas'
import RutaCarpetas from '../components/archivos/RutaCarpetas'
import { useEstadoDrive, useSubidas } from '../hooks/useSubidas'
import {
  compararNombres,
  contenidoDeCarpeta,
  elementosDirectos,
  enlaceCarpetaDrive,
  idsCarpetaYDescendientes,
  PROFUNDIDAD_MAXIMA_CARPETAS,
  rutaDeCarpeta,
  TEXTO_TAMANO_MAXIMO,
} from '../lib/archivos'
import {
  borrarCarpeta,
  crearCarpeta,
  listarArchivos,
  listarCarpetas,
  obtenerCursoConCarpeta,
  renombrarCarpeta,
} from '../lib/archivosApi'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'

// Archivos de un curso, por carpeta: primero las carpetas de la carpeta actual y luego sus archivos. La carpeta
// actual va en la URL (?carpeta=<id>), así el botón "Atrás" del navegador y recargar la página funcionan.
// Todo se lee de la base (sin consultar Drive): las carpetas y los archivos del curso se piden una sola vez y el
// árbol se arma aquí.
export default function ArchivosCurso() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const drive = useEstadoDrive()
  const [curso, setCurso] = useState(null)
  const [archivos, setArchivos] = useState([])
  const [carpetas, setCarpetas] = useState([])
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'no-encontrado' | 'error'
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([obtenerCursoConCarpeta(id), listarArchivos({ cursoId: id }), listarCarpetas(id)])
      .then(([c, lista, listaCarpetas]) => {
        if (!activo) return
        setCurso(c)
        setArchivos(lista)
        setCarpetas(listaCarpetas)
        setEstado(c ? 'listo' : 'no-encontrado')
      })
      .catch(() => activo && setEstado('error'))
    return () => {
      activo = false
    }
  }, [id])

  // La primera subida o la primera carpeta crean la carpeta del curso (o la recrean): se lee su id para
  // "Abrir carpeta en Drive".
  const refrescarCurso = useCallback(() => {
    obtenerCursoConCarpeta(id)
      .then((c) => c && setCurso(c))
      .catch(() => {})
  }, [id])

  const onSubido = useCallback(
    (fila) => {
      setArchivos((actuales) => [fila, ...actuales])
      if (!fila.carpeta_id) refrescarCurso()
    },
    [refrescarCurso],
  )
  const { subidas, agregar, limpiar } = useSubidas({ onSubido, onFallo: drive.bloquear })

  // Carpeta actual: la de la URL si existe; si no (p. ej. se borró), la del curso.
  const actual = carpetas.find((c) => c.id === params.get('carpeta')) ?? null
  const idActual = actual?.id ?? null
  const ruta = useMemo(() => rutaDeCarpeta(carpetas, idActual), [carpetas, idActual])

  const carpetasAqui = useMemo(
    () =>
      carpetas
        .filter((c) => c.parent_id === idActual)
        .sort(compararNombres)
        .map((c) => ({
          carpeta: c,
          elementos: elementosDirectos(carpetas, archivos, c.id),
          contenido: contenidoDeCarpeta(carpetas, archivos, c.id),
        })),
    [carpetas, archivos, idActual],
  )
  const archivosAqui = useMemo(
    () => archivos.filter((a) => (a.carpeta_id ?? null) === idActual),
    [archivos, idActual],
  )

  function irA(carpetaId) {
    setCreando(false)
    setParams(carpetaId ? { carpeta: carpetaId } : {})
  }

  // Las tres acciones devuelven null si salió bien o el estado del error (lo muestran los campos y las filas).
  async function crear(nombre) {
    const r = await crearCarpeta({ cursoId: curso.id, parentId: idActual, nombre })
    if (r.estado !== 'ok' || !r.carpeta) {
      drive.bloquear(r.estado)
      return r.estado === 'ok' ? 'error' : r.estado
    }
    setCarpetas((actuales) => [...actuales, r.carpeta])
    setCreando(false)
    if (!idActual) refrescarCurso()
    return null
  }

  async function renombrar(carpeta, nombre) {
    const r = await renombrarCarpeta(carpeta.id, nombre)
    if (r.estado !== 'ok' || !r.carpeta) {
      drive.bloquear(r.estado)
      return r.estado === 'ok' ? 'error' : r.estado
    }
    setCarpetas((actuales) => actuales.map((c) => (c.id === carpeta.id ? r.carpeta : c)))
    return null
  }

  async function borrar(carpeta) {
    const r = await borrarCarpeta(carpeta.id)
    if (r.estado !== 'ok') {
      drive.bloquear(r.estado)
      return r.estado
    }
    // Se quitan la carpeta, sus subcarpetas y los archivos que contenían (la función ya los borró de la base).
    const ids = idsCarpetaYDescendientes(carpetas, carpeta.id)
    setCarpetas((actuales) => actuales.filter((c) => !ids.has(c.id)))
    setArchivos((actuales) => actuales.filter((a) => !a.carpeta_id || !ids.has(a.carpeta_id)))
    return null
  }

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

  const puedeUsarDrive = !drive.cargando && !drive.estadoGoogle
  const puedeCrearAqui = ruta.length < PROFUNDIDAD_MAXIMA_CARPETAS
  const carpetaDrive = actual ? actual.drive_folder_id : curso.drive_folder_id
  const vacia = carpetasAqui.length === 0 && archivosAqui.length === 0

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

      {actual && <RutaCarpetas curso={curso} ruta={ruta} onIr={irA} />}

      <div className="mb-4 flex flex-wrap gap-2">
        {puedeUsarDrive && (
          <BotonSubir onElegir={(lista) => agregar(lista, { cursoId: curso.id, carpetaId: idActual })} />
        )}
        {puedeUsarDrive && (
          <button type="button" onClick={() => setCreando(true)} disabled={creando || !puedeCrearAqui} className={BOTON}>
            Crear carpeta
          </button>
        )}
        {carpetaDrive && (
          <a href={enlaceCarpetaDrive(carpetaDrive)} target="_blank" rel="noopener noreferrer" className={BOTON}>
            Abrir carpeta en Drive
          </a>
        )}
      </div>
      {puedeUsarDrive && (
        <p className="-mt-2 mb-4 text-xs text-gray-600 dark:text-gray-400">
          {actual && `Lo que subas se guarda en «${actual.nombre}». `}
          Máximo {TEXTO_TAMANO_MAXIMO} por archivo. No se permiten programas ni scripts (.exe, .bat, .js…).
          {!puedeCrearAqui && ` Aquí no se pueden crear más carpetas: el máximo es ${PROFUNDIDAD_MAXIMA_CARPETAS} niveles.`}
        </p>
      )}

      {creando && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <CampoNombreCarpeta
            etiqueta={actual ? `Nueva carpeta dentro de «${actual.nombre}»` : 'Nombre de la nueva carpeta'}
            textoConfirmar="Crear"
            onConfirmar={crear}
            onCancelar={() => setCreando(false)}
          />
        </div>
      )}

      <ProgresoSubidas subidas={subidas} limpiar={limpiar} />

      <section className="rounded-xl border border-gray-200 bg-white px-4 py-1 dark:border-gray-800 dark:bg-gray-900">
        {vacia ? (
          <p className="py-3 text-sm text-gray-600 dark:text-gray-400">
            {actual ? 'Esta carpeta está vacía.' : 'Este curso aún no tiene archivos.'}
          </p>
        ) : (
          <>
            {carpetasAqui.length > 0 && (
              <ListaCarpetas carpetas={carpetasAqui} onAbrir={irA} onRenombrar={renombrar} onBorrar={borrar} />
            )}
            {carpetasAqui.length > 0 && archivosAqui.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800" />
            )}
            {archivosAqui.length > 0 && (
              <ListaArchivos
                archivos={archivosAqui}
                onQuitado={(idArchivo) => setArchivos((actuales) => actuales.filter((a) => a.id !== idArchivo))}
                onFallo={drive.bloquear}
              />
            )}
          </>
        )}
      </section>
    </>
  )
}
