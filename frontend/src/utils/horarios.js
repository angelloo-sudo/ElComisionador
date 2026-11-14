// Horarios de un viaje. Las horas son "HH:MM" sin fecha: si una hora es menor que la de
// salida, ocurre al dia siguiente (el viaje paso la medianoche).
const REGEX_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
export const comoHora = (minutos) => {
  const t = ((Math.round(minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// Minutos desde la salida hasta "hora" (0 a 1439), contemplando el paso de la medianoche.
export function minutosDesdeSalida(horaSalida, hora) {
  if (!REGEX_HORA.test(horaSalida ?? '') || !REGEX_HORA.test(String(hora ?? '').slice(0, 5))) return null
  return (aMinutos(String(hora).slice(0, 5)) - aMinutos(horaSalida) + 1440) % 1440
}

// true si la llegada cae al dia siguiente de la salida.
export function llegaAlDiaSiguiente(horaSalida, horaLlegada) {
  if (!horaSalida || !horaLlegada) return false
  return String(horaLlegada).slice(0, 5) < String(horaSalida).slice(0, 5)
}

// "01:30" -> "01:30 (+1 día)" cuando el viaje termina al dia siguiente.
export function textoLlegada(horaSalida, horaLlegada) {
  if (!horaLlegada) return null
  const hora = String(horaLlegada).slice(0, 5)
  return llegaAlDiaSiguiente(horaSalida, hora) ? `${hora} (+1 día)` : hora
}

// Hora de llegada de cada tramo desde la salida. Si pasa la medianoche sigue al dia
// siguiente; solo falla si el recorrido completo dura 24 horas o mas.
export function calcularLlegadasAcumuladas(horaSalida, duraciones) {
  if (!REGEX_HORA.test(horaSalida ?? '')) return null
  let transcurrido = 0
  const llegadas = []
  for (const duracion of duraciones) {
    if (!Number.isFinite(Number(duracion)) || Number(duracion) < 0) return null
    transcurrido += Math.round(Number(duracion))
    if (transcurrido > 1439) return null
    llegadas.push(comoHora(aMinutos(horaSalida) + transcurrido))
  }
  return llegadas
}
