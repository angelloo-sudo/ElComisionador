// Horarios de un viaje que puede terminar al dia siguiente.
// Las horas se guardan como TIME ("HH:MM"), sin fecha: si una hora es menor que la de
// salida significa que ocurre despues de la medianoche (dia siguiente). Para comparar se
// usan los minutos transcurridos desde la salida (0 a 1439).

export function aMinutos(hora) {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function comoHora(minutos) {
  const t = ((Math.round(minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// "22:00" -> "01:30" = 210 minutos (pasa la medianoche).
export function minutosDesdeSalida(horaSalida, hora) {
  return (aMinutos(hora) - aMinutos(horaSalida) + 1440) % 1440
}

// Verifica que las paradas esten en orden despues de la salida y antes de la llegada,
// contemplando que el recorrido cruce la medianoche. Devuelve un mensaje o null.
export function errorOrdenParadas(horaSalida, paradas, horaLlegada) {
  let anterior = 0
  for (const parada of paradas) {
    const desde = minutosDesdeSalida(horaSalida, parada.hora_estimada)
    if (desde <= anterior) return 'Los horarios de las paradas deben ser posteriores y estar ordenados'
    anterior = desde
  }
  if (horaLlegada && paradas.length && minutosDesdeSalida(horaSalida, horaLlegada) <= anterior) {
    return 'Todas las paradas deben ocurrir antes de la llegada al destino final'
  }
  return null
}
