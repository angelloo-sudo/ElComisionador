const ZONA_HORARIA = 'America/Argentina/Cordoba'

export function hoyEnCordoba(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora)
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]))
  return `${valores.year}-${valores.month}-${valores.day}`
}

export function estadoVisibleViaje(estado, fecha, ahora = new Date()) {
  if (estado !== 'programado' || !fecha) return estado

  const fechaISO = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10)
  return fechaISO < hoyEnCordoba(ahora) ? 'vencido' : estado
}

// US20: un viaje solo se puede iniciar el dia en que esta programado (hora de Cordoba).
export function puedeIniciarViaje(viaje, ahora = new Date()) {
  if (!viaje || viaje.estado !== 'programado' || !viaje.fecha) return false
  return String(viaje.fecha).slice(0, 10) === hoyEnCordoba(ahora)
}
