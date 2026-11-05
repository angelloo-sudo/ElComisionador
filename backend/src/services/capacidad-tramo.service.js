// Calcula capacidad por cada segmento entre puntos consecutivos del itinerario.
// Las solicitudes antiguas con localidades que no coinciden con puntos publicados
// ocupan conservadoramente el recorrido completo para no liberar cupos por error.
export function lugaresEnTramo({ paradas = [], reservas = [], origen, destino, desde, hasta }) {
  const puntos = [origen, ...paradas.map((p) => p.localidad), destino]
  const indice = (localidad, lado) => {
    const i = puntos.findIndex((p) => String(p).trim().toLocaleLowerCase() === String(localidad ?? '').trim().toLocaleLowerCase())
    return i < 0 ? (lado === 'origen' ? 0 : puntos.length - 1) : i
  }
  let inicio = indice(desde, 'origen')
  let fin = indice(hasta, 'destino')
  if (inicio >= fin) return 0
  const ocupacion = Array.from({ length: puntos.length - 1 }, () => 0)
  for (const reserva of reservas) {
    let a = indice(reserva.origen_localidad || origen, 'origen')
    let b = indice(reserva.destino_localidad || destino, 'destino')
    // Si una solicitud previa usa un punto no definido en el itinerario, no hay
    // base fiable para liberar asientos en otros segmentos: ocupa el viaje entero.
    if (reserva.origen_localidad && !puntos.some((p) => p.toLocaleLowerCase() === reserva.origen_localidad.trim().toLocaleLowerCase())) a = 0
    if (reserva.destino_localidad && !puntos.some((p) => p.toLocaleLowerCase() === reserva.destino_localidad.trim().toLocaleLowerCase())) b = puntos.length - 1
    if (a >= b) { a = 0; b = puntos.length - 1 }
    for (let i = a; i < b; i++) ocupacion[i] += Number(reserva.cantidad_pasajeros) || 0
  }
  inicio = Math.max(0, inicio); fin = Math.min(puntos.length - 1, fin)
  return Math.max(0, ...ocupacion.slice(inicio, fin))
}
