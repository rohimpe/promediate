import CalendarioInicio from '../components/inicio/CalendarioInicio'
import TarjetaHoy from '../components/inicio/TarjetaHoy'
import TarjetaPromedios from '../components/inicio/TarjetaPromedios'
import TarjetaProximas from '../components/inicio/TarjetaProximas'
import { useAuth } from '../hooks/useAuth'
import { useCursosConNotas } from '../hooks/useCursosConNotas'
import { useNombrePerfil } from '../hooks/useNombrePerfil'
import { useTasks } from '../hooks/useTasks'
import { formatearDiaLargo, hoyEnLima } from '../lib/fechas'
import { nombreParaSaludo } from '../lib/inicio'

// Página de Inicio. Carga los datos UNA vez (pendientes; cursos con evaluaciones; nombre del
// perfil) y se los pasa a las tarjetas, en vez de que cada tarjeta haga su propia consulta.
//
// Celular: una columna en este orden (el orden del código): Hoy, Próximas entregas, Calendario, Promedios.
// Pantalla grande (lg): calendario a la izquierda y las tres tarjetas apiladas a la derecha.
export default function Inicio() {
  const { user } = useAuth()
  const { tareas, cargando, error, cambiar, crear } = useTasks()
  const cursos = useCursosConNotas()
  const perfil = useNombrePerfil(user?.id)

  const hoy = hoyEnLima()
  const nombre = nombreParaSaludo(perfil.nombre, user?.email)

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">
          Hola{!perfil.cargando && nombre ? `, ${nombre}` : ''} 👋
        </h1>
        <p className="text-gray-600 capitalize dark:text-gray-400">{formatearDiaLargo(hoy)}</p>
      </header>

      {/* En lg: calendario en la columna 1 (ocupa las 3 filas) y las tarjetas en la columna 2.
          La última fila (1fr) absorbe el alto sobrante para que no se abran huecos entre tarjetas. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
        <div className="lg:col-start-2">
          <TarjetaHoy tareas={tareas} cargando={cargando} error={error} cambiar={cambiar} hoy={hoy} />
        </div>
        <div className="lg:col-start-2">
          <TarjetaProximas tareas={tareas} cargando={cargando} error={error} hoy={hoy} />
        </div>
        <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <CalendarioInicio tareas={tareas} cambiar={cambiar} crear={crear} />
        </div>
        <div className="lg:col-start-2">
          <TarjetaPromedios cursos={cursos.cursos} cargando={cursos.cargando} error={cursos.error} />
        </div>
      </div>
    </>
  )
}
