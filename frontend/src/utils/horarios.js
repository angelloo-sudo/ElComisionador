export function calcularLlegadasAcumuladas(horaSalida, duraciones) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaSalida ?? '')) return null
  let total = Number(horaSalida.slice(0, 2)) * 60 + Number(horaSalida.slice(3))
  const llegadas = []
  for (const duracion of duraciones) {
    if (!Number.isFinite(Number(duracion)) || Number(duracion) < 0) return null
    total += Math.round(Number(duracion))
    if (total > 1439) return null
    llegadas.push(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`)
  }
  return llegadas
}
