// Formatos y cuentas de la tarifa por km y la duracion de los viajes.
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 29200 -> "$ 29.200,00"
export function formatoPesos(valor) {
  if (valor == null || valor === '' || !Number.isFinite(Number(valor))) return '—'
  return pesos.format(Number(valor))
}

// 36.5 -> "36,5 km"
export function formatoKm(km) {
  if (km == null || !Number.isFinite(Number(km))) return '—'
  return `${String(Number(km)).replace('.', ',')} km`
}

// 85 -> "1 h 25 min"
export function formatoDuracion(min) {
  if (min == null || !Number.isFinite(Number(min))) return '—'
  const total = Math.round(Number(min))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// Hora de llegada aproximada = salida + duracion ("08:00" + 45 -> "08:45"). Pasada la medianoche
// devuelve "hh:mm (+1 día)".
export function horaDeLlegada(horaSalida, min) {
  if (!horaSalida || min == null) return null
  const [h, m] = String(horaSalida).slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + Math.round(Number(min))
  const dias = Math.floor(total / 1440)
  const t = total % 1440
  const hora = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  return dias > 0 ? `${hora} (+${dias} día${dias > 1 ? 's' : ''})` : hora
}

// precio por km x km (x personas si viaja un pasajero). null si falta algun dato.
export function calcularMonto({ precioKm, distanciaKm, tipo = 'pasajero', cantidad = 1 }) {
  const p = Number(precioKm)
  const km = Number(distanciaKm)
  if (precioKm == null || distanciaKm == null || !(p > 0) || !(km > 0)) return null
  const personas = tipo === 'pasajero' ? Math.max(1, Number(cantidad) || 1) : 1
  return Math.round(p * km * personas * 100) / 100
}
