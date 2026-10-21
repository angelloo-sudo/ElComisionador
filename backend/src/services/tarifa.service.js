// Tarifa por km del comisionista y datos de ruta de un viaje (distancia, duracion, hora de llegada).
//  - El comisionista configura su precio por km (pesos ARS).
//  - La distancia y la duracion las calcula el sistema con la ruta en auto (OpenStreetMap / OSRM).
//  - Monto = precio por km x distancia en km (x cantidad de personas si es un pasajero).
import { query } from '../config/db.js'
import { calcularRuta } from './geo.service.js'

export const PRECIO_KM_MAXIMO = 1_000_000

const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Monto en pesos (2 decimales) o null si falta algun dato.
//  - pasajero: precio_km x km x cantidad de pasajeros
//  - encomienda: precio_km x km (una sola vez)
export function calcularMonto({ precioKm, distanciaKm, tipo = 'pasajero', cantidad = 1 }) {
  const precio = Number(precioKm)
  const km = Number(distanciaKm)
  if (precioKm == null || distanciaKm == null || !Number.isFinite(precio) || !Number.isFinite(km) || precio <= 0 || km <= 0) return null
  const personas = tipo === 'pasajero' ? Math.max(1, Number(cantidad) || 1) : 1
  return redondear2(precio * km * personas)
}

// Suma minutos a una hora "HH:MM" y devuelve "HH:MM". No pasa de la medianoche (tope 23:55) para
// que el viaje siga siendo del mismo dia.
export function sumarMinutos(horaSalida, minutos) {
  const [h, m] = String(horaSalida).slice(0, 5).split(':').map(Number)
  const total = Math.min(h * 60 + m + Math.max(0, Math.round(minutos)), 23 * 60 + 55)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Ruta en auto entre dos localidades. Devuelve { distancia_km, duracion_min } o
// { distancia_km: null, duracion_min: null } si no se pudo calcular con precision (servicio caido):
// en ese caso el viaje se guarda igual y los datos se completan despues (ver asegurarRutaDeViaje).
export async function datosDeRuta(origen, destino) {
  try {
    const r = await calcularRuta(origen, destino)
    if (r.aproximada || r.duracion_min == null) return { distancia_km: null, duracion_min: null }
    return { distancia_km: r.distancia_km, duracion_min: r.duracion_min }
  } catch {
    return { distancia_km: null, duracion_min: null }
  }
}

// Datos que se guardan en el viaje: distancia, duracion y hora de llegada (salida + duracion).
export async function datosDeViaje(origen, destino, horaSalida) {
  const { distancia_km, duracion_min } = await datosDeRuta(origen, destino)
  return {
    distancia_km,
    duracion_min,
    hora_llegada: duracion_min != null ? sumarMinutos(horaSalida, duracion_min) : null,
  }
}

// Si un viaje quedo sin distancia/duracion (el servicio de mapas no respondia al crearlo), lo
// intenta completar ahora. Devuelve { distancia_km, duracion_min } (pueden seguir siendo null).
export async function asegurarRutaDeViaje(viaje, db = { query }) {
  if (viaje.distancia_km != null && viaje.duracion_min != null) {
    return { distancia_km: Number(viaje.distancia_km), duracion_min: viaje.duracion_min }
  }
  const datos = await datosDeRuta(viaje.origen, viaje.destino)
  if (datos.distancia_km != null) {
    const llegada = viaje.hora_salida ? sumarMinutos(viaje.hora_salida, datos.duracion_min) : null
    await db.query(
      'UPDATE viajes SET distancia_km = $2, duracion_min = $3, hora_llegada = COALESCE($4::time, hora_llegada) WHERE id = $1',
      [viaje.id, datos.distancia_km, datos.duracion_min, llegada],
    )
  }
  return datos
}
