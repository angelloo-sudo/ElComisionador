// Paradas de un viaje: las que salen de las solicitudes de los clientes (donde suben/bajan o donde se
// retira/entrega una encomienda) y una "ruta sugerida" para el comisionista.
//
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

// Nombre de quien sube/baja (pasajero) o de quien entrega/recibe el paquete (encomienda: el emisor en el
// retiro y el receptor en la entrega). Las encomiendas no tienen nombre/apellido propios.
function quienEs(s, lado) {
  const completo = (n, a) => `${n ?? ''} ${a ?? ''}`.trim()
  if (s.tipo === 'encomienda') {
    const persona = lado === 'origen' ? completo(s.emisor_nombre, s.emisor_apellido) : completo(s.receptor_nombre, s.receptor_apellido)
    if (persona) return persona
  }
  return completo(s.nombre, s.apellido) || 'Sin nombre'
}

function estadoActividad(solicitud, lado) {
  if (solicitud.estado !== 'aceptada') return 'pendiente_respuesta'
  if (solicitud.tipo === 'encomienda') {
    return lado === 'origen'
      ? solicitud.retirada_en ? 'completada' : 'pendiente'
      : solicitud.entregada_en ? 'completada' : 'pendiente'
  }
  if (solicitud.estado_pasajero === 'en_destino' || (lado === 'origen' && solicitud.estado_pasajero === 'a_bordo')) return 'completada'
  return 'pendiente'
}

function direccionSolicitud(solicitud, lado) {
  const calle = solicitud[`${lado}_calle`]
  const altura = solicitud[`${lado}_altura`]
  const barrio = solicitud[`${lado}_barrio`]
  const codigoPostal = solicitud[`${lado}_codigo_postal`]
  const direccion = [
    [calle, altura].filter(Boolean).join(' '),
    barrio,
    codigoPostal ? `CP ${codigoPostal}` : null,
  ].filter(Boolean).join(', ')
  return direccion || null
}

// Solicitudes del viaje; detalle=true agrega persona, direccion y coordenadas para el comisionista.
export async function paradasDeViaje(viaje, {
  estados = ['aceptada'], detalle = false, incluirExtremos = false, incluirLegadas = false,
} = {}) {
  const { rows } = await query(
    `SELECT id, tipo, estado, nombre, apellido, cantidad_pasajeros,
            emisor_nombre, emisor_apellido, receptor_nombre, receptor_apellido,
            origen_localidad, destino_localidad,
            origen_calle, origen_altura, origen_barrio, origen_codigo_postal,
            destino_calle, destino_altura, destino_barrio, destino_codigo_postal,
            estado_pasajero, retirada_en, entregada_en
     FROM solicitudes_viaje WHERE viaje_id = $1 AND estado = ANY($2)
       AND COALESCE(estado_pasajero, '') NOT IN ('ausente', 'cancelado_comisionista') ORDER BY id`,
    [viaje.id, estados],
  )
  const paradas = []
  for (const s of rows) {
    for (const lado of ['origen', 'destino']) {
      const localidad = s[`${lado}_localidad`] ?? viaje[lado]
      const esIntermedia = claveNormalizada(localidad) !== claveNormalizada(viaje[lado])
      if (!incluirExtremos && !esIntermedia) continue
      const calle = s[`${lado}_calle`]
      const altura = s[`${lado}_altura`]
      let lat = null
      let lon = null
      let exacta = false
      if (detalle && esIntermedia && calle && altura) {
        try {
          const r = await validarDireccion({ calle, altura, localidad, codigoPostal: s[`${lado}_codigo_postal`] }, { conCodigoPostal: false })
          if (r.estado === 'ok') { lat = r.lat; lon = r.lon; exacta = true }
        } catch { /* se usa el centro de la localidad */ }
      }
      if (lat == null) {
        try {
          const c = await centroLocalidad(localidad)
          lat = c.lat; lon = c.lon
        } catch {
          if (!detalle) continue
        }
      }
      if (lat == null && !detalle) continue
      paradas.push({
        solicitud_id: s.id,
        tipo: s.tipo,
        estado: s.estado,
        estado_pasajero: s.estado_pasajero,
        accion: VERBOS[s.tipo][lado],
        lado,
        localidad,
        lat,
        lon,
        es_intermedia: esIntermedia,
        estado_actividad: estadoActividad(s, lado),
        ...(detalle ? {
          persona: quienEs(s, lado),
          direccion: direccionSolicitud(s, lado),
          codigo_seguimiento: null,
          exacta,
          cantidad: s.tipo === 'pasajero' ? s.cantidad_pasajeros : 1,
        } : {}),
      })
    }
  }
  if (detalle && incluirExtremos && incluirLegadas) {
    const [{ rows: encomiendas }, { rows: pasajeros }] = await Promise.all([
      query(
        `SELECT id, remitente_nombre, direccion_retiro, destinatario_nombre, destinatario_direccion, estado, retirado_en
         FROM encomiendas WHERE viaje_id = $1 AND estado <> 'cancelada' ORDER BY id`,
        [viaje.id],
      ),
      query(
        `SELECT vp.pasajero_id, p.nombre, vp.punto_ascenso, vp.punto_descenso
         FROM viaje_pasajero vp JOIN pasajeros p ON p.id = vp.pasajero_id
         WHERE vp.viaje_id = $1 AND vp.estado = 'activo' ORDER BY vp.pasajero_id`,
        [viaje.id],
      ),
    ])
    for (const encomienda of encomiendas) {
      for (const lado of ['origen', 'destino']) {
        const esRetiro = lado === 'origen'
        const estadoActividad = esRetiro
          ? encomienda.retirado_en || ['retirado', 'recibido', 'en_viaje', 'entregado'].includes(encomienda.estado)
            ? 'completada' : 'pendiente'
          : ['recibido', 'entregado'].includes(encomienda.estado) ? 'completada' : 'pendiente'
        paradas.push(actividadLegada(viaje, {
          id: encomienda.id,
          tipo: 'encomienda',
          lado,
          localidad: null,
          direccion: esRetiro ? encomienda.direccion_retiro : encomienda.destinatario_direccion,
          persona: esRetiro ? encomienda.remitente_nombre : encomienda.destinatario_nombre,
          estado: encomienda.estado,
          estadoActividad,
        }))
      }
    }
    for (const pasajero of pasajeros) {
      for (const lado of ['origen', 'destino']) {
        paradas.push(actividadLegada(viaje, {
          id: pasajero.pasajero_id,
          tipo: 'pasajero',
          lado,
          localidad: lado === 'origen' ? pasajero.punto_ascenso : pasajero.punto_descenso,
          direccion: null,
          persona: pasajero.nombre,
          estado: 'activo',
          estadoActividad: 'sin_estado',
        }))
      }
    }
  }
  return paradas
}

function actividadLegada(viaje, { id, tipo, lado, localidad, direccion, persona, estado, estadoActividad }) {
  const localidadRegistrada = typeof localidad === 'string' && localidad.trim() ? localidad.trim() : null
  const ubicacion = localidadRegistrada ?? 'Localidad no informada'
  const esIntermedia = !localidadRegistrada
    || (claveNormalizada(ubicacion) !== claveNormalizada(viaje.origen)
      && claveNormalizada(ubicacion) !== claveNormalizada(viaje.destino))
  return {
    actividad_id: `legada-${tipo}-${id}-${lado}`,
    encomienda_id: tipo === 'encomienda' ? id : null,
    pasajero_id: tipo === 'pasajero' ? id : null,
    tipo,
    estado,
    estado_actividad: estadoActividad,
    accion: VERBOS[tipo][lado],
    lado,
    localidad: ubicacion,
    localidad_desconocida: !localidadRegistrada,
    direccion: direccion?.trim() || null,
    persona: persona?.trim() || 'Sin nombre',
    codigo_seguimiento: null,
    cantidad: 1,
    lat: null,
    lon: null,
    es_intermedia: esIntermedia,
  }
}

function claveNormalizada(valor) {
  return String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function claveActividad(solicitudId, lado) {
  return `${solicitudId}:${lado}`
}

export function agruparRecorrido(viaje, actividades, sugerencia = null) {
  const claveOrigen = claveNormalizada(viaje.origen)
  const claveDestino = claveNormalizada(viaje.destino)
  const origen = { tipo: 'origen', localidad: viaje.origen, actividades: [] }
  const destino = { tipo: 'destino', localidad: viaje.destino, actividades: [] }
  const intermedias = []

  for (const actividad of actividades) {
    const localidad = claveNormalizada(actividad.localidad)
    if (localidad === claveOrigen && (claveOrigen !== claveDestino || actividad.lado === 'origen')) {
      origen.actividades.push(actividad)
      continue
    }
    if (localidad === claveDestino) {
      destino.actividades.push(actividad)
      continue
    }

    const localidadActividad = claveNormalizada(actividad.localidad)
    const direccionActividad = claveNormalizada(actividad.direccion)
    let parada = intermedias.find((actual) =>
      (!actividad.localidad_desconocida && !actual.localidad_desconocida
        && claveNormalizada(actual.localidad) === localidadActividad)
      || (direccionActividad && actual.direcciones.has(direccionActividad)))
    if (!parada) {
      parada = {
        tipo: 'intermedia',
        localidad: actividad.localidad,
        localidad_desconocida: Boolean(actividad.localidad_desconocida),
        actividades: [],
        direcciones: new Set(),
      }
      intermedias.push(parada)
    }
    parada.actividades.push(actividad)
    if (direccionActividad) parada.direcciones.add(direccionActividad)
  }

  const rangos = new Map((sugerencia?.estado === 'ok' ? sugerencia.orden : []).map((p, index) => [
    claveActividad(p.solicitud_id, p.lado),
    index,
  ]))
  const hayPendientesDeConfirmar = actividades.some((actividad) => actividad.estado === 'pendiente')
  const ubicacionIncompleta = intermedias.some((parada) =>
    parada.localidad_desconocida || parada.actividades.some((actividad) => actividad.lat == null || actividad.lon == null))
  const ordenConfirmado = !ubicacionIncompleta && (intermedias.length <= 1
    || (sugerencia?.estado === 'ok' && !hayPendientesDeConfirmar))
  if (sugerencia?.estado === 'ok') {
    intermedias.sort((a, b) => {
      const rango = (parada) => Math.min(...parada.actividades
        .map((actividad) => rangos.get(claveActividad(actividad.solicitud_id, actividad.lado)) ?? Infinity))
      return rango(a) - rango(b)
    })
  }

  destino.actividades.push({
    tipo: 'viaje',
    accion: 'finalizar',
    estado_actividad: viaje.estado === 'cancelado' ? 'cancelada' : viaje.estado === 'finalizado' ? 'completada' : 'pendiente',
    estado_viaje: viaje.estado,
    persona: null,
    direccion: null,
    codigo_seguimiento: null,
  })

  return {
    paradas: [origen, ...intermedias.map(({ direcciones, ...parada }) => parada), destino],
    orden_confirmado: ordenConfirmado,
  }
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
