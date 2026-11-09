import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { invalidarEventosGoogle } from '../hooks/useGoogleEventos'
import { useSeguimientoGoogle } from '../hooks/useSeguimientoGoogle'
import {
  desconectarGoogle,
  obtenerConexionGoogle,
  pedirUrlConexionGoogle,
} from '../lib/googleApi'

const MENSAJES_RETORNO = {
  ok: { tipo: 'ok', texto: 'Google se conectó correctamente.' },
  error: {
    tipo: 'error',
    texto: 'No se pudo conectar Google. Inténtalo de nuevo y acepta todos los permisos que se piden.',
  },
}

const BOTON_PRIMARIO =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60'

// Ajustes de cómo entran los eventos de Google a Hoy y Pendientes: el interruptor de "todo el día" y la lista
// de lo que el usuario quitó (con "Volver a incluir").
function AjustesEventos({ seguimiento }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function ejecutar(accion) {
    setError('')
    setOcupado(true)
    try {
      await accion()
    } catch {
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-800">
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            checked={seguimiento.incluirTodoElDia}
            disabled={ocupado || seguimiento.cargando}
            onChange={(e) => ejecutar(() => seguimiento.cambiarIncluirTodoElDia(e.target.checked))}
            className="size-4 accent-indigo-600"
          />
          Incluir eventos de todo el día en mis pendientes
        </label>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Los eventos con hora entran solos a Hoy y Pendientes. Los de todo el día (feriados, cumpleaños…) solo si
          activas esto.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Eventos ocultos</h3>
        {seguimiento.ocultos.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            No has quitado ninguno. Puedes quitar un evento o una serie desde su panel en el Calendario.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
            {seguimiento.ocultos.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{o.titulo}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{o.serie_id ? 'Toda la serie' : 'Un evento'}</p>
                </div>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => ejecutar(() => seguimiento.volverAIncluir(o))}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Volver a incluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(error || seguimiento.error) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error || seguimiento.error}
        </p>
      )}
    </div>
  )
}

// Página "Conexiones": cuentas externas que el usuario enlaza con la app (por ahora, Google).
export default function Conexiones() {
  const [params, setParams] = useSearchParams()
  const seguimiento = useSeguimientoGoogle() // marcados, ocultos y la preferencia de "todo el día"
  const [conexion, setConexion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  // Mensaje al volver de Google (?google=ok o ?google=error). Se lee una sola vez al abrir.
  const [aviso] = useState(() => MENSAJES_RETORNO[params.get('google')] ?? null)

  // Limpia el parámetro para que al recargar no reaparezca el mensaje.
  useEffect(() => {
    if (params.has('google')) setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    let activo = true
    obtenerConexionGoogle()
      .then((c) => activo && setConexion(c))
      .catch(() => activo && setError('No se pudo consultar el estado de Google.'))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  async function conectar() {
    setError('')
    setOcupado(true)
    try {
      const url = await pedirUrlConexionGoogle()
      window.location.assign(url) // sale de la app hacia Google
    } catch {
      setError('No se pudo iniciar la conexión con Google. Inténtalo de nuevo.')
      setOcupado(false)
    }
  }

  async function desconectar() {
    const ok = window.confirm(
      '¿Desconectar tu cuenta de Google? La app dejará de poder usar tu Calendar y tu Drive. Puedes volver a conectarla cuando quieras.',
    )
    if (!ok) return
    setError('')
    setOcupado(true)
    try {
      await desconectarGoogle()
      invalidarEventosGoogle() // el calendario no debe seguir mostrando los eventos ya cargados
      setConexion({ conectado: false, email_google: null, estado: null })
    } catch {
      setError('No se pudo desconectar Google. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  const reconectar = conexion?.conectado && conexion.estado === 'reconectar'
  const conectado = conexion?.conectado && !reconectar

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Conexiones</h1>

      {aviso && (
        <p
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            aviso.tipo === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Google</h2>
          {!cargando && conexion && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                conectado
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : reconectar
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {conectado ? 'Conectado' : reconectar ? 'Reconectar' : 'No conectado'}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Tus eventos de Google Calendar entran solos a Hoy y Pendientes. Más adelante tus pendientes aparecerán en Calendar y podrás guardar archivos en
          tu Drive.
        </p>

        {cargando && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Cargando…</p>}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {!cargando && conexion && (
          <div className="mt-3">
            {conectado && (
              <p className="text-sm">
                Cuenta: <span className="font-medium break-all">{conexion.email_google}</span>
              </p>
            )}
            {reconectar && (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Google rechazó el permiso guardado{conexion.email_google ? ` para ${conexion.email_google}` : ''}.
                Vuelve a conectar tu cuenta para seguir usándola.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!conectado && (
                <button onClick={conectar} disabled={ocupado} className={BOTON_PRIMARIO}>
                  {reconectar ? 'Reconectar Google' : 'Conectar Google'}
                </button>
              )}
              {conexion.conectado && (
                <button
                  onClick={desconectar}
                  disabled={ocupado}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>
        )}

        {!cargando && conexion?.conectado && <AjustesEventos seguimiento={seguimiento} />}
      </section>
    </>
  )
}
