// Paradas de un viaje: las que salen de las solicitudes de los clientes (donde suben/bajan o donde se
// retira/entrega una encomienda) y una "ruta sugerida" para el comisionista.
//
// Una parada solo existe si es intermedia: subir en el origen del viaje o bajar en su destino no es parada.
// La ruta sugerida es solo informativa: reordena las paradas para recorrer menos km. No cambia ningun precio
// (cada solicitud guarda el suyo) ni se guarda nada.
import { query } from '../config/db.js'
import { calcularRuta, calcularMatrizKm, calcularRutaPorPuntos, centroLocalidad, validarDireccion } from './geo.service.js'
import { ubicarEnRuta } from './tramo.service.js'

export const MAX_PARADAS_SUGERENCIA = 8
// Menos que esto no vale la pena proponer un cambio de orden.
export const MIN_AHORRO_KM = 0.5

const redondear1 = (n) => Math.round(n * 10) / 10

const VERBOS = {
  pasajero: { origen: 'sube', destino: 'baja' },
  encomienda: { origen: 'retira', destino: 'entrega' },
}

// Solicitudes del viaje con sus paradas intermedias. detalle=true agrega nombre, direccion y coordenadas exactas.
export async function paradasDeViaje(viaje, { estados = ['aceptada'], detalle = false } = {}) {
  const { rows } = await query(
    `SELECT id, tipo, estado, nombre, apellido, cantidad_pasajeros,
            origen_localidad, destino_localidad, origen_calle, origen_altura, origen_codigo_postal, destino_calle, destino_altura, destino_codigo_postal
     FROM solicitudes_viaje WHERE viaje_id = $1 AND estado = ANY($2) ORDER BY id`,
    [viaje.id, estados],
  )
  const paradas = []
  for (const s of rows) {
    for (const lado of ['origen', 'destino']) {
      const localidad = s[`${lado}_localidad`] ?? viaje[lado]
      if (localidad === viaje[lado]) continue // sube en el origen / baja en el destino: no es una parada intermedia
      const calle = s[`${lado}_calle`]
      const altura = s[`${lado}_altura`]
      let lat = null
      let lon = null
      let exacta = false
      if (detalle && calle && altura) {
        try {
          const r = await validarDireccion({ calle, altura, localidad, codigoPostal: s[`${lado}_codigo_postal`] }, { conCodigoPostal: false })
          if (r.estado === 'ok') { lat = r.lat; lon = r.lon; exacta = true }
        } catch { /* se usa el centro de la localidad */ }
      }
      if (lat == null) {
        try {
          const c = await centroLocalidad(localidad)
          lat = c.lat; lon = c.lon
        } catch { continue } // sin coordenadas no se puede dibujar
      }
      paradas.push({
        solicitud_id: s.id,
        tipo: s.tipo,
        estado: s.estado,
        accion: VERBOS[s.tipo][lado],
        lado,
        localidad,
        lat,
        lon,
        ...(detalle ? { persona: `${s.nombre} ${s.apellido}`.trim(), direccion: `${calle} ${altura}`.trim(), exacta, cantidad: s.tipo === 'pasajero' ? s.cantidad_pasajeros : 1 } : {}),
      })
    }
  }
  return paradas
}

// Lo que ve un cliente que mira el viaje: solo localidades (nunca nombres ni calles), de las solicitudes aceptadas.
export function paradasPublicas(paradas) {
  const porLocalidad = new Map()
  for (const p of paradas) {
    const actual = porLocalidad.get(p.localidad) ?? { localidad: p.localidad, lat: p.lat, lon: p.lon, acciones: [] }
    if (!actual.acciones.includes(p.accion)) actual.acciones.push(p.accion)
    porLocalidad.set(p.localidad, actual)
  }
  return [...porLocalidad.values()]
}

// Mejor orden de las paradas (cada persona sube antes de bajar) con la matriz de km. Prueba todas las
// combinaciones validas, con poda: con hasta 8 paradas son muy pocas.
// puntos: [inicio, ...paradas, fin]; precede[i] = indice (en paradas) que debe visitarse antes que la parada i, o -1.
export function mejorOrden(matriz, n, precede) {
  let mejor = { km: Infinity, orden: [] }
  const usado = new Array(n).fill(false)
  const orden = []
  const visitar = (actual, km) => {
    if (km >= mejor.km) return
    if (orden.length === n) {
      const total = km + matriz[actual][n + 1]
      if (total < mejor.km) mejor = { km: total, orden: [...orden] }
      return
    }
    for (let i = 0; i < n; i++) {
      if (usado[i] || (precede[i] >= 0 && !usado[precede[i]])) continue
      usado[i] = true; orden.push(i)
      visitar(i + 1, km + matriz[actual][i + 1])
      orden.pop(); usado[i] = false
    }
  }
  visitar(0, 0)
  return mejor
}

export const kmDeOrden = (matriz, n, orden) => {
  let km = 0
  let actual = 0
  for (const i of orden) { km += matriz[actual][i + 1]; actual = i + 1 }
  return km + matriz[actual][n + 1]
}

// Ruta sugerida: { estado: 'ok', mejora, km_actual, km_sugerido, ahorro_km, orden: [...], geometria }
//  { estado: 'sin_paradas' }  hay menos de 2 paradas: no hay nada que reordenar
//  { estado: 'demasiadas' }   mas paradas de las que se analizan
//  { estado: 'no_disponible' } el servicio de mapas no respondio
export async function rutaSugerida(viaje, paradas) {
  const n = paradas.length
  if (n < 2) return { estado: 'sin_paradas' }
  if (n > MAX_PARADAS_SUGERENCIA) return { estado: 'demasiadas' }
  try {
    const base = await calcularRuta(viaje.origen, viaje.destino)
    if (base.aproximada) return { estado: 'no_disponible' }
    const puntos = [base.origen, ...paradas, base.destino].map((p) => ({ lat: p.lat, lon: p.lon }))
    const matriz = await calcularMatrizKm(puntos)

    // Orden "natural": el que se encuentra yendo por la ruta original (primero las que estan mas cerca del origen).
    const kmEnRuta = paradas.map((p) => ubicarEnRuta(base.geometria, p).s)
    const natural = paradas.map((_, i) => i).sort((a, b) => kmEnRuta[a] - kmEnRuta[b] || (paradas[a].lado === 'origen' ? -1 : 1))
    // Una persona sube antes de bajar; si en la ruta original quedaran al reves, se corrige en el orden natural.
    const precede = paradas.map((p) => (p.lado === 'destino' ? paradas.findIndex((q) => q.solicitud_id === p.solicitud_id && q.lado === 'origen') : -1))
    const naturalValido = []
    const pendientes = [...natural]
    while (pendientes.length) {
      const k = pendientes.findIndex((i) => precede[i] < 0 || naturalValido.includes(precede[i]))
      naturalValido.push(pendientes.splice(k, 1)[0])
    }
    const kmActual = kmDeOrden(matriz, n, naturalValido)
    const mejor = mejorOrden(matriz, n, precede)
    const mejora = kmActual - mejor.km >= MIN_AHORRO_KM
    const ordenFinal = mejora ? mejor.orden : naturalValido
    const ruta = await calcularRutaPorPuntos([puntos[0], ...ordenFinal.map((i) => puntos[i + 1]), puntos[n + 1]])
    return {
      estado: 'ok',
      mejora,
      km_actual: redondear1(kmActual),
      km_sugerido: redondear1(mejora ? mejor.km : kmActual),
      ahorro_km: mejora ? redondear1(kmActual - mejor.km) : 0,
      orden: ordenFinal.map((i, k) => ({ n: k + 1, ...paradas[i] })),
      geometria: ruta.geometria,
    }
  } catch {
    return { estado: 'no_disponible' }
  }
}
