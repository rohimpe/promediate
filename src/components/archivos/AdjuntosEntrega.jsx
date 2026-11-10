import { useCallback, useEffect, useState } from 'react'
import { useCourses } from '../../hooks/useCourses'
import { useEstadoDrive, useSubidas } from '../../hooks/useSubidas'
import { listarArchivos } from '../../lib/archivosApi'
import CampoSelect from '../CampoSelect'
import AvisoDrive from './AvisoDrive'
import BotonSubir from './BotonSubir'
import ListaArchivos from './ListaArchivos'
import ProgresoSubidas from './ProgresoSubidas'

// Selector de curso para una entrega sin curso (solo se monta en ese caso, así no se piden los cursos de más).
function ElegirCurso({ valor, onChange }) {
  const { cursos, cargando } = useCourses()
  if (!cargando && cursos.length === 0) {
    return <p className="text-xs text-gray-600 dark:text-gray-400">Crea un curso en Promedios para adjuntar archivos.</p>
  }
  return (
    <CampoSelect
      id="curso-adjunto"
      label="Esta entrega no tiene curso: elige en qué carpeta guardarlo"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Elige un curso</option>
      {cursos.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </CampoSelect>
  )
}

// Archivos adjuntos de una entrega, con "Adjuntar archivo". Lo usan el panel del calendario y el formulario de
// editar. Los archivos van a la carpeta de Drive del curso y quedan vinculados con task_id.
//   tarea:   la fila de `tasks` (debe existir: una entrega nueva aún no tiene id)
//   cursoId: el curso donde guardar (el de la entrega o el elegido en el formulario); si falta, se pide uno
export default function AdjuntosEntrega({ tarea, cursoId }) {
  const drive = useEstadoDrive()
  const [archivos, setArchivos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cursoElegido, setCursoElegido] = useState('')
  const destino = cursoId || cursoElegido

  useEffect(() => {
    let activo = true
    listarArchivos({ tareaId: tarea.id })
      .then((lista) => activo && setArchivos(lista))
      .catch(() => activo && setError('No se pudieron cargar los archivos adjuntos.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [tarea.id])

  const onSubido = useCallback((fila) => setArchivos((actuales) => [fila, ...actuales]), [])
  const { subidas, agregar, limpiar } = useSubidas({ onSubido, onFallo: drive.bloquear })
  const quitar = (id) => setArchivos((actuales) => actuales.filter((a) => a.id !== id))

  const puedeSubir = !drive.cargando && !drive.estadoGoogle

  return (
    <section aria-label="Archivos adjuntos" className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
      <h3 className="text-sm font-semibold">Archivos adjuntos</h3>

      {cargando && <p className="text-xs text-gray-600 dark:text-gray-400">Cargando…</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!cargando && !error && archivos.length === 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400">Aún no tiene archivos.</p>
      )}
      {archivos.length > 0 && <ListaArchivos archivos={archivos} onQuitado={quitar} onFallo={drive.bloquear} compacto />}

      <ProgresoSubidas subidas={subidas} limpiar={limpiar} />

      <AvisoDrive estado={drive.estadoGoogle} compacto />
      {puedeSubir && (
        <div className="space-y-2">
          {!cursoId && <ElegirCurso valor={cursoElegido} onChange={setCursoElegido} />}
          <BotonSubir
            texto="Adjuntar archivo"
            disabled={!destino}
            onElegir={(lista) => agregar(lista, { cursoId: destino, tareaId: tarea.id })}
            className="py-1.5"
          />
        </div>
      )}
    </section>
  )
}
