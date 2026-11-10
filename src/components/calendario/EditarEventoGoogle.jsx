import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useComprobarChoques } from '../../hooks/useComprobarChoques'
import { aplicarEventoEditado, recargarEventosGoogle } from '../../hooks/useGoogleEventos'
import { googleAEventos } from '../../lib/calendario'
import {
  cambiosDeEdicion,
  MAX_LUGAR_EVENTO,
  MAX_TITULO_EVENTO,
  MENSAJES_EDICION,
  MENSAJES_NO_EDITABLE,
  NO_EDITABLE_GENERICO,
  valoresInicialesEdicion,
} from '../../lib/edicionGoogle'
import { editarEventoGoogle } from '../../lib/googleApi'
import { coloresGuardados, normalizarTitulo } from '../../lib/seguimiento'
import AdvertenciaChoques from '../AdvertenciaChoques'
import CampoTexto from '../CampoTexto'
import SelectorHora from '../SelectorHora'

const BOTON =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800'
const BOTON_PRINCIPAL =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60'
const AVISO_AMBAR =
  'rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'

// Formulario para editar desde la app un evento que ya existía en Google Calendar (Parte C2). Va dentro de PanelEvento.
//   evento:      evento del calendario (origen 'google', editable). Se lee en cada render: tras "Actualizar" trae
//                el etag nuevo, y lo escrito en el formulario se conserva.
//   seguimiento: el de useSeguimientoGoogle (opcional): refresca el resumen guardado si el evento ya estaba marcado
//                y avisa si había un color guardado por título
//   onGuardado(nuevo): al guardar bien; `nuevo` es la ocurrencia editada (evento del calendario) o null
//   onCancelar
//
// Si el evento es de una serie, primero pregunta "¿Solo este evento o toda la serie?". En la serie solo se cambian
// el título y el lugar (los campos de fecha y hora se deshabilitan). Los cambios de horario pasan por la misma
// advertencia de choques que los pendientes.
export default function EditarEventoGoogle({ evento, seguimiento, onGuardado, onCancelar }) {
  const { user } = useAuth()
  const comprobarChoques = useComprobarChoques()
  const [iniciales] = useState(() => valoresInicialesEdicion(evento))
  const [alcance, setAlcance] = useState(evento.serieId ? null : 'este') // null = aún no eligió
  const [titulo, setTitulo] = useState(iniciales.titulo)
  const [lugar, setLugar] = useState(iniciales.lugar)
  const [fecha, setFecha] = useState(iniciales.fecha)
  const [horaInicio, setHoraInicio] = useState(iniciales.horaInicio)
  const [horaFin, setHoraFin] = useState(iniciales.horaFin)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [conflicto, setConflicto] = useState(false)
  const [choques, setChoques] = useState(null) // lo que se cruza con el horario nuevo (null = sin advertencia)

  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const enSerie = alcance === 'serie'
  const horarioBloqueado = enSerie || !iniciales.horarioEditable

  // Si el título cambia y había un color guardado para "todos los <título>", ese color se queda con el título anterior.
  const colorPorTitulo = seguimiento ? coloresGuardados(evento, seguimiento.reglas).titulo : null
  const avisoColor =
    colorPorTitulo && normalizarTitulo(titulo) && normalizarTitulo(titulo) !== normalizarTitulo(evento.titulo)

  // Cambiar el día o la hora deja obsoleta la advertencia de choques: se quita y se vuelve a comprobar al guardar.
  const quitandoAviso = (setter) => (valor) => {
    setChoques(null)
    setter(valor)
  }

  function calcular() {
    return cambiosDeEdicion(evento, { titulo, lugar, fecha, horaInicio, horaFin }, iniciales, alcance)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setConflicto(false)
    const { cambios, cambiaHorario, error: invalido } = calcular()
    if (invalido) return setError(invalido)

    // Mismo chequeo que al guardar una actividad: compara con las actividades de la app y los demás eventos de Google.
    if (cambiaHorario && !evento.todoElDia) {
      setEnviando(true)
      const encontrados = await comprobarChoques({ fecha, horaInicio, horaFin, excluirGoogleId: evento.googleId })
      if (!montado.current) return
      setEnviando(false)
      if (encontrados.length > 0) return setChoques(encontrados)
    }
    await guardar(cambios)
  }

  async function guardar(cambios = calcular().cambios) {
    if (!cambios) return
    setEnviando(true)
    setError('')
    setConflicto(false)
    const r = await editarEventoGoogle({ eventoId: evento.googleId, alcance, cambios, etag: evento.etag })
    if (!montado.current) return

    if (r.estado !== 'ok') {
      // Lo escrito se conserva: solo se explica qué pasó.
      setEnviando(false)
      setChoques(null)
      if (r.estado === 'conflicto') setConflicto(true)
      else if (r.estado === 'no_editable') setError(MENSAJES_NO_EDITABLE[r.motivo] ?? NO_EDITABLE_GENERICO)
      else setError(MENSAJES_EDICION[r.estado] ?? MENSAJES_EDICION.error)
      return
    }

    // Calendario, Hoy y Pendientes leen la misma caché: se reemplaza el evento y se enteran solos.
    if (r.evento) aplicarEventoEditado(user?.id, r.evento)
    // En una serie cambian también las otras ocurrencias: se vuelven a pedir a Google.
    if (enSerie || !r.evento) recargarEventosGoogle()
    const nuevo = r.evento ? googleAEventos([r.evento])[0] ?? null : null

    // Si el evento ya estaba marcado (Fui / Justificar), su fila guarda el título y el horario nuevos.
    if (seguimiento) {
      try {
        if (enSerie && cambios.titulo) await seguimiento.actualizarResumen({ serieId: evento.serieId, titulo: cambios.titulo }, 'serie')
        else if (!enSerie && nuevo) await seguimiento.actualizarResumen(nuevo, 'este')
      } catch {
        // El evento ya cambió en Google; solo la copia guardada quedó con los datos anteriores (el error salió en consola).
      }
    }
    if (!montado.current) return
    onGuardado(nuevo)
  }

  function actualizar() {
    setConflicto(false)
    recargarEventosGoogle() // trae el evento como está ahora (con su etag nuevo); lo escrito se conserva
  }

  function cambiarHora() {
    setChoques(null)
    requestAnimationFrame(() => document.getElementById('editar-google-inicio-horas')?.focus())
  }

  if (alcance === null) {
    return (
      <div className="space-y-3">
        <h2 className="font-semibold">Editar «{evento.titulo}»</h2>
        <p className="text-sm font-medium">¿Solo este evento o toda la serie?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setAlcance('este')} className={`${BOTON} sm:flex-1`}>
            Solo este evento
          </button>
          <button type="button" onClick={() => setAlcance('serie')} className={`${BOTON} sm:flex-1`}>
            Toda la serie
          </button>
        </div>
        <button type="button" onClick={onCancelar} className="text-sm font-medium text-gray-600 underline dark:text-gray-400">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <h2 className="font-semibold">Editar evento de Google</h2>
        {evento.serieId && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {enSerie ? 'Toda la serie' : 'Solo este evento'} ·{' '}
            <button
              type="button"
              disabled={enviando}
              onClick={() => {
                setChoques(null)
                setError('')
                setAlcance(null)
              }}
              className="font-medium underline"
            >
              Cambiar
            </button>
          </p>
        )}
      </div>

      <CampoTexto
        id="editar-google-titulo"
        label="Título"
        type="text"
        required
        maxLength={MAX_TITULO_EVENTO}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      {avisoColor && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Tienes un color guardado para todos los «{evento.titulo}». Seguirá aplicándose a ese título, no al nuevo: si
          quieres, elige el color otra vez después de guardar.
        </p>
      )}

      <fieldset disabled={horarioBloqueado} className="min-w-0 disabled:opacity-60">
        <CampoTexto
          id="editar-google-fecha"
          label={evento.todoElDia && iniciales.dias > 1 ? `Fecha de inicio (dura ${iniciales.dias} días)` : 'Fecha'}
          type="date"
          required={!horarioBloqueado}
          value={fecha}
          onChange={(e) => quitandoAviso(setFecha)(e.target.value)}
        />
      </fieldset>
      {!evento.todoElDia && (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset disabled={horarioBloqueado} className="min-w-0 disabled:opacity-60">
            <SelectorHora id="editar-google-inicio" label="Hora de inicio" valor={horaInicio} onChange={quitandoAviso(setHoraInicio)} />
          </fieldset>
          <fieldset disabled={horarioBloqueado} className="min-w-0 disabled:opacity-60">
            <SelectorHora id="editar-google-fin" label="Hora de fin" valor={horaFin} onChange={quitandoAviso(setHoraFin)} />
          </fieldset>
        </div>
      )}
      {enSerie && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          En toda la serie solo se cambian el título y el lugar. Para mover el horario, elige «Solo este evento».
        </p>
      )}
      {!enSerie && !iniciales.horarioEditable && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Este evento termina otro día: cambia su horario en Google Calendar.
        </p>
      )}

      <CampoTexto
        id="editar-google-lugar"
        label="Lugar (opcional)"
        type="text"
        maxLength={MAX_LUGAR_EVENTO}
        value={lugar}
        onChange={(e) => setLugar(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {conflicto && (
        <div role="alert" className={`space-y-2 ${AVISO_AMBAR}`}>
          <p>El evento cambió en Google: actualiza y vuelve a intentar.</p>
          <button
            type="button"
            onClick={actualizar}
            className="rounded-lg border border-amber-400 px-3 py-1.5 font-medium hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900"
          >
            Actualizar
          </button>
        </div>
      )}

      {choques ? (
        <AdvertenciaChoques choques={choques} onGuardar={() => guardar()} onCambiar={cambiarHora} ocupado={enviando} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={enviando} className={`${BOTON_PRINCIPAL} sm:flex-1`}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button type="button" disabled={enviando} onClick={onCancelar} className={BOTON}>
            Cancelar
          </button>
        </div>
      )}
    </form>
  )
}
