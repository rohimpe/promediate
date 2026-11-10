import { diasEntre, fechaEnLima, horaEnLima, sumarDias } from './fechas'

// ---------------------------------------------------------------------
// Editar desde la app un evento que ya existía en Google Calendar (Parte C2). Funciones puras y textos;
// la llamada a Google está en googleApi.js (editarEventoGoogle) y el formulario en EditarEventoGoogle.jsx.
// ---------------------------------------------------------------------

// Mismos topes que la Edge Function google-calendar-editar (si cambian allí, cambiarlos aquí).
export const MAX_TITULO_EVENTO = 300
export const MAX_LUGAR_EVENTO = 500

// Línea corta del panel cuando un evento NO se puede editar (motivoNoEditable de google-calendar-events).
export const MOTIVO_NO_EDITABLE = {
  invitados: 'No se puede editar desde la app: tiene invitados.',
  organizador: 'No se puede editar desde la app: lo organiza otra persona.',
  app: 'Este evento lo creó la app: edítalo desde su pendiente.',
}

// Mensajes del formulario según lo que respondió la función.
export const MENSAJES_EDICION = {
  no_conectado: 'Google no está conectado. Conéctalo en Conexiones y vuelve a intentar.',
  reconectar: 'Google pide volver a conectar tu cuenta. Hazlo en Conexiones y vuelve a intentar.',
  permisos_incompletos: 'Falta el permiso de Google Calendar. Vuelve a conectar tu cuenta en Conexiones.',
  error: 'No se pudo guardar en Google Calendar. Inténtalo de nuevo.',
}

// Explicación de 'no_editable' según el motivo que devolvió la función.
export const MENSAJES_NO_EDITABLE = {
  invitados: 'Este evento tiene invitados: cámbialo en Google Calendar para que les llegue el aviso.',
  organizador: 'Este evento lo organiza otra persona: solo ella puede cambiarlo.',
  app: 'Este evento lo creó la app: edítalo desde su pendiente.',
  serie_horario: 'En toda la serie solo se pueden cambiar el título y el lugar. Para mover el horario, elige «Solo este evento».',
  sin_serie: 'Este evento ya no pertenece a una serie. Actualiza y vuelve a intentar.',
  google: 'Google no permite cambiar este evento desde la app. Ábrelo en Google Calendar.',
}
export const NO_EDITABLE_GENERICO = 'Este evento no se puede editar desde la app. Ábrelo en Google Calendar.'

// Valores iniciales del formulario a partir de un evento del calendario (googleAEventos).
//   { titulo, lugar, fecha, horaInicio, horaFin, dias, horarioEditable }
//   - de todo el día: `fecha` es el primer día (aunque se haya tocado otro de un evento de varios días) y `dias` lo que dura
//   - con hora: `horarioEditable` es false si termina otro día (el formulario solo maneja un día con inicio y fin)
export function valoresInicialesEdicion(evento) {
  const base = { titulo: evento.titulo ?? '', lugar: evento.lugar ?? '' }
  if (evento.todoElDia) {
    const inicio = evento.diasGoogle?.inicio ?? fechaEnLima(evento.inicio)
    const fin = evento.diasGoogle?.fin ?? sumarDias(inicio, 1)
    return { ...base, fecha: inicio, horaInicio: '', horaFin: '', dias: Math.max(diasEntre(inicio, fin), 1), horarioEditable: true }
  }
  const fecha = fechaEnLima(evento.inicio)
  return {
    ...base,
    fecha,
    horaInicio: horaEnLima(evento.inicio),
    horaFin: horaEnLima(evento.fin),
    dias: 1,
    horarioEditable: fechaEnLima(evento.fin) === fecha,
  }
}

// Lo que cambió respecto del evento, en el formato que espera google-calendar-editar.
//   valores:  lo escrito en el formulario ({ titulo, lugar, fecha, horaInicio, horaFin })
//   iniciales: valoresInicialesEdicion(evento) (de cuando se abrió el formulario)
//   alcance:  'este' | 'serie' (en la serie no se manda horario)
// Devuelve { cambios, cambiaHorario, error }: `error` es un texto para el usuario si algo no cuadra.
export function cambiosDeEdicion(evento, valores, iniciales, alcance) {
  const titulo = valores.titulo.trim()
  if (!titulo) return { error: 'Escribe un título.' }

  const cambios = {}
  if (titulo !== evento.titulo) cambios.titulo = titulo
  const lugar = valores.lugar.trim()
  if (lugar !== (evento.lugar ?? '')) cambios.lugar = lugar

  let cambiaHorario = false
  if (alcance === 'este' && iniciales.horarioEditable) {
    if (!valores.fecha) return { error: 'Elige la fecha.' }
    if (evento.todoElDia) {
      if (valores.fecha !== iniciales.fecha) {
        cambios.inicio = valores.fecha
        cambios.fin = sumarDias(valores.fecha, iniciales.dias) // en Google el fin de un evento de día es exclusivo
        cambiaHorario = true
      }
    } else if (
      valores.fecha !== iniciales.fecha ||
      valores.horaInicio !== iniciales.horaInicio ||
      valores.horaFin !== iniciales.horaFin
    ) {
      if (valores.horaFin <= valores.horaInicio) return { error: 'La hora de fin debe ser posterior a la hora de inicio.' }
      cambios.inicio = `${valores.fecha}T${valores.horaInicio}`
      cambios.fin = `${valores.fecha}T${valores.horaFin}`
      cambiaHorario = true
    }
  }

  if (Object.keys(cambios).length === 0) return { error: 'No cambiaste nada.' }
  return { cambios, cambiaHorario, error: null }
}
