// Tramo que recorre un cliente dentro de un viaje: sube en una localidad (parada de subida o retiro) y baja
// en otra (parada de bajada o entrega). Las dos tienen que estar sobre la ruta del viaje y en orden.
// Los km del tramo son los de la ruta real en auto entre la parada de subida y la de bajada (OSRM), asi que
// si una parada obliga a desviarse de la ruta original, ese desvio tambien se cobra (solo a ese cliente).
// La ruta original del viaje se usa para validar que las paradas esten sobre el recorrido y en orden.
// Si sube en el origen y baja en el destino, son exactamente los km del viaje completo.
// Si OSRM no puede calcular la ruta entre las paradas, se usa la proporcion del recorrido original.
import { calcularRuta, calcularRutaEntrePuntos, centroLocalidad, distanciaKm } from './geo.service.js'
import { esLocalidadValida } from './localidades.service.js'

// Hasta cuantos km de la ruta se acepta una localidad como "parada del recorrido".
export const MAX_DESVIO_KM = 15
// Tramo minimo para que tenga sentido (menos que eso es subir y bajar en el mismo lugar).
export const MIN_TRAMO_KM = 1

const rad = (g) => (g * Math.PI) / 180

// Punto de la ruta mas cercano a "punto" ({lat, lon}) y cuantos km hay desde el inicio de la ruta hasta ahi.
// geometria: [[lat, lon], ...]. Devuelve { s, desvio, punto, largoTotal } (todo en km).
export function ubicarEnRuta(geometria, punto) {
  const tramos = []
  let acumulado = 0
  for (let i = 0; i < geometria.length - 1; i++) {
    const a = { lat: geometria[i][0], lon: geometria[i][1] }
    const b = { lat: geometria[i + 1][0], lon: geometria[i + 1][1] }
    const largo = distanciaKm(a, b)
    tramos.push({ a, b, largo, inicio: acumulado })
    acumulado += largo
  }
  let mejor = null
  for (const t of tramos) {
    // Proyeccion plana local (alcanza para tramos cortos): x este-oeste, y norte-sur, en km.
    const k = Math.cos(rad(t.a.lat))
    const bx = (t.b.lon - t.a.lon) * k * 111.32
    const by = (t.b.lat - t.a.lat) * 110.57
    const px = (punto.lon - t.a.lon) * k * 111.32
    const py = (punto.lat - t.a.lat) * 110.57
    const l2 = bx * bx + by * by
    const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / l2))
    const dx = px - u * bx
    const dy = py - u * by
    const desvio = Math.sqrt(dx * dx + dy * dy)
    if (!mejor || desvio < mejor.desvio) {
      mejor = {
        desvio,
        s: t.inicio + u * t.largo,
        punto: { lat: t.a.lat + u * (t.b.lat - t.a.lat), lon: t.a.lon + u * (t.b.lon - t.a.lon) },
      }
    }
  }
  return { ...mejor, largoTotal: acumulado }
}

// Parte de la ruta entre los km "desde" y "hasta" (medidos desde el inicio): [[lat, lon], ...].
export function cortarRuta(geometria, desde, hasta) {
  const salida = []
  let acumulado = 0
  const interpolar = (a, b, u) => [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]
  for (let i = 0; i < geometria.length - 1; i++) {
    const a = geometria[i]
    const b = geometria[i + 1]
    const largo = distanciaKm({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] })
    const ini = acumulado
    const fin = acumulado + largo
    acumulado = fin
    if (fin < desde || ini > hasta || largo === 0) continue
    const u0 = Math.max(0, (desde - ini) / largo)
    const u1 = Math.min(1, (hasta - ini) / largo)
    if (salida.length === 0) salida.push(interpolar(a, b, u0))
    salida.push(interpolar(a, b, u1))
  }
  return salida
}

const redondear1 = (n) => Math.round(n * 10) / 10

// Calcula el tramo entre dos localidades dentro del viaje.
//  { estado: 'ok', km, desde: {nombre, lat, lon}, hasta: {...}, geometria }
//  { estado: 'invalido', mensaje }      -> las localidades no sirven para este viaje
//  { estado: 'no_disponible' }          -> no se pudo calcular ahora (servicio de mapas caido)
//
// `puntos` (opcional) trae las coordenadas reales de la direccion verificada de cada parada:
// { desde: {lat, lon}, hasta: {lat, lon} }. Con ellas la parada intermedia se ubica en la ruta
// por la calle y altura exactas y no por el centro de la localidad. Los extremos del viaje
// (origen/destino publicados por el comisionista) siempre se toman exactos.
export async function calcularTramo(viaje, desdeNombre, hastaNombre, puntos = {}) {
  for (const n of [desdeNombre, hastaNombre]) {
    if (esLocalidadValida(n) === false) return { estado: 'invalido', mensaje: 'Elegí las localidades de la lista' }
  }
  if (desdeNombre === hastaNombre) {
    return { estado: 'invalido', mensaje: 'Elegí dos localidades distintas: una donde subís y otra donde bajás' }
  }
  let ruta
  try {
    ruta = await calcularRuta(viaje.origen, viaje.destino)
  } catch {
    return { estado: 'no_disponible' }
  }
  if (ruta.aproximada) return { estado: 'no_disponible' }

  const geometria = ruta.geometria
  let largoTotal = 0
  for (let i = 0; i < geometria.length - 1; i++) {
    largoTotal += distanciaKm({ lat: geometria[i][0], lon: geometria[i][1] }, { lat: geometria[i + 1][0], lon: geometria[i + 1][1] })
  }
  const extremo = (i) => ({ lat: geometria[i][0], lon: geometria[i][1] })
  const ubicar = async (nombre, exacto) => {
    // Los extremos del viaje se toman exactos, sin proyectar.
    if (nombre === viaje.origen) return { s: 0, desvio: 0, punto: extremo(0), real: extremo(0), precisa: false }
    if (nombre === viaje.destino) return { s: largoTotal, desvio: 0, punto: extremo(geometria.length - 1), real: extremo(geometria.length - 1), precisa: false }
    if (exacto && Number.isFinite(exacto.lat) && Number.isFinite(exacto.lon)) {
      // La parada se muestra donde esta la direccion; el km se mide donde ese punto toca la ruta.
      return { ...ubicarEnRuta(geometria, exacto), punto: { lat: exacto.lat, lon: exacto.lon }, real: { lat: exacto.lat, lon: exacto.lon }, precisa: true }
    }
    const centro = await centroLocalidad(nombre)
    return { ...ubicarEnRuta(geometria, centro), real: { lat: centro.lat, lon: centro.lon }, precisa: false }
  }
  let desde
  let hasta
  try {
    desde = await ubicar(desdeNombre, puntos.desde)
    hasta = await ubicar(hastaNombre, puntos.hasta)
  } catch {
    return { estado: 'no_disponible' }
  }

  if (desde.desvio > MAX_DESVIO_KM) {
    return { estado: 'invalido', mensaje: `${desdeNombre} no está sobre el recorrido de este viaje (${viaje.origen} → ${viaje.destino})` }
  }
  if (hasta.desvio > MAX_DESVIO_KM) {
    return { estado: 'invalido', mensaje: `${hastaNombre} no está sobre el recorrido de este viaje (${viaje.origen} → ${viaje.destino})` }
  }
  if (hasta.s <= desde.s) {
    return { estado: 'invalido', mensaje: `El viaje va de ${viaje.origen} a ${viaje.destino}: ${hastaNombre} tiene que estar después de ${desdeNombre}` }
  }
  // Km del tramo: ruta real entre las dos paradas (incluye los desvios). Plan B: proporcion de la ruta original.
  const proporcion = (hasta.s - desde.s) / largoTotal
  let km = redondear1(proporcion * ruta.distancia_km)
  let trazado = null
  try {
    trazado = await calcularRutaEntrePuntos(desde.real, hasta.real)
    km = trazado.distancia_km
  } catch { /* se queda con la proporcion */ }
  if (km < MIN_TRAMO_KM) {
    return { estado: 'invalido', mensaje: 'Las dos localidades quedan casi en el mismo lugar del recorrido. Elegí paradas más separadas' }
  }
  return {
    estado: 'ok',
    km,
    desde: { nombre: desdeNombre, lat: desde.punto.lat, lon: desde.punto.lon, precisa: desde.precisa },
    hasta: { nombre: hastaNombre, lat: hasta.punto.lat, lon: hasta.punto.lon, precisa: hasta.precisa },
    geometria: trazado ? trazado.geometria : cortarRuta(geometria, desde.s, hasta.s),
  }
}

