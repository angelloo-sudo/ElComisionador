// US19 - Solicitudes de los clientes sobre los viajes del comisionista.
// El cliente elige un viaje y envia una solicitud como PASAJERO (con cantidad de personas) o
// para una ENCOMIENDA. Queda 'pendiente' hasta que el comisionista la acepta o rechaza.
// Solo las solicitudes de pasajero ACEPTADAS ocupan cupo (suma de cantidad_pasajeros).
import { pool, query } from '../config/db.js'
import { validarSolicitud } from '../validators/solicitud.validador.js'
import { SQL_OCUPADOS } from '../services/viajes.service.js'
import { validarDireccion } from '../services/geo.service.js'
import { asegurarRutaDeViaje, calcularMonto } from '../services/tarifa.service.js'
import { calcularTramo } from '../services/tramo.service.js'

const TZ = "NOW() AT TIME ZONE 'America/Argentina/Cordoba'"
const INICIO = "(v.fecha + COALESCE(v.hora_salida, TIME '00:00'))"

// Ejecuta "trabajo" dentro de una transaccion. El trabajo devuelve { status, body } para responder
// (se confirma ANTES de contestar) o abortar(status, mensaje) para revertir y avisar.
const abortar = (status, mensaje) => ({ abortar: true, status, mensaje })

async function conTransaccion(res, next, trabajo) {
  let cliente
  let abierta = false
  try {
    cliente = await pool.connect()
    await cliente.query('BEGIN')
    abierta = true
    const resultado = await trabajo(cliente)
    if (resultado.abortar) {
      await cliente.query('ROLLBACK')
      abierta = false
      return res.status(resultado.status).json({ mensaje: resultado.mensaje })
    }
    await cliente.query('COMMIT')
    abierta = false
    return res.status(resultado.status).json(resultado.body)
  } catch (e) {
    if (cliente && abierta) {
      try { await cliente.query('ROLLBACK') } catch (errorRollback) { return next(errorRollback) }
    }
    next(e)
  } finally {
    cliente?.release()
  }
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

// Solicitudes del cliente logueado sobre el viaje que siguen "vigentes": pendiente o aceptada.
// Si fue cancelada por el cliente o rechazada por el comisionista, puede volver a solicitar el mismo tipo.
const ESTADOS_QUE_BLOQUEAN = `'pendiente', 'aceptada'`
const SQL_MIS_SOLICITUDES = (n) => `COALESCE((SELECT json_agg(json_build_object('tipo', s.tipo, 'estado', s.estado) ORDER BY s.tipo)
                        FROM solicitudes_viaje s JOIN clientes c ON c.id = s.cliente_id
                        WHERE s.viaje_id = v.id AND c.usuario_id = $${n} AND s.estado IN (${ESTADOS_QUE_BLOQUEAN})), '[]'::json) AS mis_solicitudes`

const CAMPOS_VIAJE_DISPONIBLE = `
  v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada,
  v.duracion_min,
  CASE WHEN cm.precio_km IS NOT NULL AND v.distancia_km IS NOT NULL THEN ROUND(cm.precio_km * v.distancia_km, 2) END AS precio_pasajero,
  v.cupo_total, ${SQL_OCUPADOS} AS ocupados,
  GREATEST(v.cupo_total - ${SQL_OCUPADOS}, 0) AS cupos_disponibles,
  u.nombre AS comisionista_nombre, u.apellido AS comisionista_apellido`

const FILTRO_VIAJE_DISPONIBLE = `
  v.estado = 'programado' AND u.rol = 'comisionista' AND u.activo = true
  AND ${INICIO} > (${TZ})`

// Viajes programados y futuros con el cupo ocupado/total. Los llenos tambien se muestran:
// no se puede viajar de pasajero, pero se puede enviar una encomienda.
export async function listarViajesDisponibles(req, res, next) {
  try {
    const { origen, destino, fecha } = req.query
    const params = [req.usuario.id]
    let filtros = ''
    if (origen) { params.push(`%${String(origen).trim()}%`); filtros += ` AND v.origen ILIKE $${params.length}` }
    if (destino) { params.push(`%${String(destino).trim()}%`); filtros += ` AND v.destino ILIKE $${params.length}` }
    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return res.status(400).json({ mensaje: 'La fecha de búsqueda no es válida' })
      params.push(fecha); filtros += ` AND v.fecha = $${params.length}::date`
    }
    const { rows } = await query(
      `SELECT ${CAMPOS_VIAJE_DISPONIBLE},
              ${SQL_MIS_SOLICITUDES(1)}
       FROM viajes v JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN comisionistas cm ON cm.usuario_id = v.usuario_id
       WHERE ${FILTRO_VIAJE_DISPONIBLE} ${filtros}
       ORDER BY v.fecha, v.hora_salida, v.id
       LIMIT 200`,
      params,
    )
    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtenerViajeDisponible(req, res, next) {
  try {
    const id = Number(req.params.viajeId)
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ mensaje: 'El viaje solicitado no es válido' })
    const { rows } = await query(
      `SELECT ${CAMPOS_VIAJE_DISPONIBLE}, ${SQL_MIS_SOLICITUDES(2)}
       FROM viajes v JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN comisionistas cm ON cm.usuario_id = v.usuario_id
       WHERE v.id = $1 AND ${FILTRO_VIAJE_DISPONIBLE}`,
      [id, req.usuario.id],
    )
    if (!rows[0]) return res.status(404).json({ mensaje: 'El viaje no está disponible para solicitar' })
    res.json(rows[0])
  } catch (e) { next(e) }
}

const COLUMNAS_SOLICITUD = [
  'tipo', 'origen_localidad', 'destino_localidad', 'origen_calle', 'origen_altura', 'origen_codigo_postal', 'origen_descripcion',
  'destino_calle', 'destino_altura', 'destino_codigo_postal',
  'nombre', 'apellido', 'dni', 'telefono', 'lleva_equipaje', 'equipaje_detalle', 'cantidad_pasajeros', 'forma_pago',
  'peso_kg', 'ancho_cm', 'largo_cm', 'fragil', 'tipo_contenido', 'contenido_descripcion',
  'emisor_nombre', 'emisor_apellido', 'emisor_telefono', 'receptor_nombre', 'receptor_apellido', 'receptor_telefono',
]

// Verifica que las direcciones existan (Georef) en la localidad elegida para cada una (subida/retiro y
// bajada/entrega). Solo se rechaza si la calle no existe en toda la provincia; si el servicio no responde
// o no puede confirmar la altura, se deja pasar. Devuelve el mensaje de error o null.
async function direccionesInexistentes(datos) {
  for (const [prefijo, etiqueta] of [['origen', 'de retiro'], ['destino', 'de destino']]) {
    const calle = datos[`${prefijo}_calle`]
    const altura = datos[`${prefijo}_altura`]
    const r = await validarDireccion({ calle, altura, localidad: datos[`${prefijo}_localidad`], codigoPostal: datos[`${prefijo}_codigo_postal`] }, { conCodigoPostal: false })
    if (r.estado === 'no_encontrada') {
      return `No encontramos la dirección ${etiqueta} (${calle} ${altura}). Revisá que la calle esté bien escrita`
    }
  }
  return null
}

// Coordenadas reales (Georef) de la calle y altura de cada parada, para medir el tramo con mayor precision.
// Solo se usan las que se pudieron confirmar y que no son los extremos del viaje; si el servicio no responde
// o no ubica la altura, esa parada se mide con el centro de su localidad.
async function puntosDeParadas(viaje, { desde, hasta, desdeCalle, desdeAltura, desdeCp, hastaCalle, hastaAltura, hastaCp }) {
  const buscar = async (localidad, calle, altura, codigoPostal) => {
    if (!calle || !altura || localidad === viaje.origen || localidad === viaje.destino) return undefined
    const r = await validarDireccion({ calle, altura, localidad, codigoPostal }, { conCodigoPostal: false })
    return r.estado === 'ok' ? { lat: r.lat, lon: r.lon } : undefined
  }
  const [d, h] = await Promise.all([buscar(desde, desdeCalle, desdeAltura, desdeCp), buscar(hasta, hastaCalle, hastaAltura, hastaCp)])
  return { desde: d, hasta: h }
}

const precioDePersona = (precioKm, km) => calcularMonto({ precioKm, distanciaKm: km })

// Datos del viaje + tarifa del comisionista.
async function datosDeViaje(viajeId) {
  const { rows } = await query(
    `SELECT v.id, v.origen, v.destino, v.hora_salida, v.distancia_km, v.duracion_min, cm.precio_km
     FROM viajes v LEFT JOIN comisionistas cm ON cm.usuario_id = v.usuario_id WHERE v.id = $1`,
    [viajeId],
  )
  return rows[0] ?? null
}

// Km del tramo que hace el cliente y tarifa. Si sube en el origen y baja en el destino son los km del viaje;
// si no, se calcula sobre la ruta (ver services/tramo.service.js).
// Devuelve { precio_km, distancia_km, tramo } o { error: { status, mensaje } }.
async function tramoDeSolicitud(viaje, desde, hasta, direcciones = {}) {
  const precioKm = viaje.precio_km != null ? Number(viaje.precio_km) : null
  if (desde === viaje.origen && hasta === viaje.destino) {
    const ruta = await asegurarRutaDeViaje(viaje)
    return { precio_km: precioKm, distancia_km: ruta.distancia_km, tramo: null }
  }
  const puntos = await puntosDeParadas(viaje, { desde, hasta, ...direcciones })
  const tramo = await calcularTramo(viaje, desde, hasta, puntos)
  if (tramo.estado === 'invalido') return { error: { status: 400, mensaje: tramo.mensaje } }
  if (tramo.estado === 'no_disponible') {
    return { error: { status: 503, mensaje: 'No pudimos calcular el tramo en este momento. Probá de nuevo en unos minutos' } }
  }
  return { precio_km: precioKm, distancia_km: tramo.km, tramo }
}

// GET /api/solicitudes/viajes-disponibles/:viajeId/tramo?desde=Localidad&hasta=Localidad  (cliente)
// Responde el precio por persona del tramo y la parte de la ruta para dibujarla en el mapa. No expone la tarifa ni los km.
export async function tramoDeViaje(req, res, next) {
  try {
    const viajeId = Number(req.params.viajeId)
    if (!Number.isSafeInteger(viajeId) || viajeId < 1) return res.status(400).json({ mensaje: 'El viaje solicitado no es válido' })
    const viaje = await datosDeViaje(viajeId)
    if (!viaje) return res.status(404).json({ mensaje: 'El viaje no está disponible para solicitar' })
    const desde = String(req.query.desde ?? viaje.origen).trim()
    const hasta = String(req.query.hasta ?? viaje.destino).trim()
    const q = (c) => String(req.query[c] ?? '').trim().slice(0, 120)
    const r = await tramoDeSolicitud(viaje, desde, hasta, {
      desdeCalle: q('desde_calle'), desdeAltura: q('desde_altura'), hastaCalle: q('hasta_calle'), hastaAltura: q('hasta_altura'),
      desdeCp: q('desde_cp'), hastaCp: q('hasta_cp'),
    })
    if (r.error) return res.json({ estado: r.error.status === 400 ? 'invalido' : 'no_disponible', mensaje: r.error.mensaje })
    const precio = precioDePersona(r.precio_km, r.distancia_km)
    // Sin tramo calculado (viaje completo) el mapa usa la ruta completa del viaje.
    res.json({
      estado: 'ok',
      precio_persona: precio,
      completo: r.tramo === null,
      desde: r.tramo?.desde ?? null,
      hasta: r.tramo?.hasta ?? null,
      geometria: r.tramo?.geometria ?? null,
    })
  } catch (e) { next(e) }
}

// GET /api/solicitudes/:id/tramo  (comisionista): el tramo de una solicitud recibida, para verlo en el mapa.
export async function tramoDeSolicitudRecibida(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
    const { rows } = await query(
      `SELECT s.origen_localidad, s.destino_localidad, s.origen_calle, s.origen_altura, s.origen_codigo_postal, s.destino_calle, s.destino_altura, s.destino_codigo_postal, v.origen, v.destino
       FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id WHERE s.id = $1 AND v.usuario_id = $2`,
      [id, req.usuario.id],
    )
    const s = rows[0]
    if (!s) return res.status(404).json({ mensaje: 'No se encontró la solicitud' })
    const desde = s.origen_localidad ?? s.origen
    const hasta = s.destino_localidad ?? s.destino
    if (desde === s.origen && hasta === s.destino) return res.json({ estado: 'ok', completo: true, desde: null, hasta: null, geometria: null })
    const puntos = await puntosDeParadas(s, {
      desde, hasta, desdeCalle: s.origen_calle, desdeAltura: s.origen_altura, desdeCp: s.origen_codigo_postal, hastaCalle: s.destino_calle, hastaAltura: s.destino_altura, hastaCp: s.destino_codigo_postal,
    })
    const tramo = await calcularTramo(s, desde, hasta, puntos)
    if (tramo.estado !== 'ok') return res.json({ estado: tramo.estado, mensaje: tramo.mensaje ?? null })
    res.json({ estado: 'ok', completo: false, desde: tramo.desde, hasta: tramo.hasta, geometria: tramo.geometria })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  const viajeId = Number(req.body?.viaje_id)
  if (!Number.isSafeInteger(viajeId) || viajeId < 1) return res.status(400).json({ mensaje: 'El viaje solicitado no es válido' })
  const { errores, datos } = validarSolicitud(req.body)
  if (errores.length > 0) return res.status(400).json({ errores })

  // Localidad de subida/retiro y de bajada/entrega: si no se eligio otra, las del viaje (recorrido completo).
  let tarifa
  try {
    const viaje = await datosDeViaje(viajeId)
    if (!viaje) return res.status(404).json({ mensaje: 'No se encontró el viaje solicitado' })
    datos.origen_localidad = datos.origen_localidad ?? viaje.origen
    datos.destino_localidad = datos.destino_localidad ?? viaje.destino

    const direccionMala = await direccionesInexistentes(datos)
    if (direccionMala) return res.status(400).json({ mensaje: direccionMala })

    // Km del tramo y tarifa del comisionista (si el viaje no tenia ruta calculada, se completa ahora).
    tarifa = await tramoDeSolicitud(viaje, datos.origen_localidad, datos.destino_localidad, {
      desdeCalle: datos.origen_calle, desdeAltura: datos.origen_altura, desdeCp: datos.origen_codigo_postal,
      hastaCalle: datos.destino_calle, hastaAltura: datos.destino_altura, hastaCp: datos.destino_codigo_postal,
    })
    if (tarifa.error) return res.status(tarifa.error.status).json({ mensaje: tarifa.error.mensaje })
  } catch (e) { return next(e) }

  await conTransaccion(res, next, async (db) => {
    const { rows: viajes } = await db.query(
      `SELECT v.id, v.estado, v.cupo_total, ${INICIO} > (${TZ}) AS antes_del_inicio, ${SQL_OCUPADOS} AS ocupados
       FROM viajes v WHERE v.id = $1 FOR UPDATE OF v`,
      [viajeId],
    )
    const viaje = viajes[0]
    if (!viaje) return abortar(404, 'No se encontró el viaje solicitado')
    if (viaje.estado !== 'programado') return abortar(409, 'Solo podés solicitar viajes programados')
    if (!viaje.antes_del_inicio) return abortar(409, 'No podés solicitar un viaje que ya inició')

    const { rows: clientes } = await db.query(
      `SELECT c.id FROM clientes c JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.usuario_id = $1 AND u.activo = true FOR UPDATE OF c`,
      [req.usuario.id],
    )
    if (!clientes[0]) return abortar(404, 'No se encontró el perfil de cliente')
    const clienteId = clientes[0].id

    const { rows: previas } = await db.query(
      `SELECT 1 FROM solicitudes_viaje WHERE viaje_id = $1 AND cliente_id = $2 AND tipo = $3 AND estado IN (${ESTADOS_QUE_BLOQUEAN})`,
      [viajeId, clienteId, datos.tipo],
    )
    if (previas.length > 0) {
      return abortar(409, datos.tipo === 'pasajero'
        ? 'Ya solicitaste viajar como pasajero en este viaje. Para volver a solicitarlo, cancelá antes la solicitud anterior'
        : 'Ya solicitaste enviar una encomienda en este viaje. Para volver a solicitarlo, cancelá antes la solicitud anterior')
    }

    if (datos.tipo === 'pasajero') {
      const libres = Math.max(Number(viaje.cupo_total ?? 0) - viaje.ocupados, 0)
      if (libres === 0) return abortar(409, 'El viaje ya no tiene cupos disponibles para pasajeros')
      if (datos.cantidad_pasajeros > libres) {
        return abortar(409, `Solo quedan ${libres} lugar${libres === 1 ? '' : 'es'} disponible${libres === 1 ? '' : 's'} en este viaje`)
      }
    }

    // Monto = precio por km del comisionista x distancia (x cantidad de pasajeros). Se guarda con la
    // tarifa vigente: si despues la cambia, esta solicitud no cambia de precio.
    const monto = calcularMonto({
      precioKm: tarifa.precio_km, distanciaKm: tarifa.distancia_km, tipo: datos.tipo, cantidad: datos.cantidad_pasajeros,
    })
    const columnas = ['viaje_id', 'cliente_id', ...COLUMNAS_SOLICITUD, 'distancia_km', 'precio_km', 'monto']
    const valores = [viajeId, clienteId, ...COLUMNAS_SOLICITUD.map((c) => datos[c] ?? null),
      tarifa.distancia_km, monto == null ? null : tarifa.precio_km, monto]
    const marcadores = columnas.map((_, i) => `$${i + 1}`)
    const { rows } = await db.query(
      `INSERT INTO solicitudes_viaje (${columnas.join(', ')}) VALUES (${marcadores.join(', ')})
       RETURNING id, viaje_id, tipo, estado, monto`,
      valores,
    )
    return { status: 201, body: rows[0] }
  })
}

export async function listarMias(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT s.id, s.tipo, s.estado, s.motivo_rechazo, s.cantidad_pasajeros, s.forma_pago, s.creado_en,
              s.monto, s.origen_localidad, s.destino_localidad,
              s.origen_calle, s.origen_altura, s.origen_barrio, s.origen_codigo_postal, s.destino_calle, s.destino_altura, s.destino_barrio, s.destino_codigo_postal,
              v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada, v.duracion_min,
              v.estado AS estado_viaje,
              u.nombre AS comisionista_nombre, u.apellido AS comisionista_apellido,
              (s.estado IN ('pendiente', 'aceptada') AND v.estado = 'programado' AND ${INICIO} > (${TZ})) AS puede_cancelar
       FROM solicitudes_viaje s
       JOIN clientes c ON c.id = s.cliente_id
       JOIN viajes v ON v.id = s.viaje_id
       JOIN usuarios u ON u.id = v.usuario_id
       WHERE c.usuario_id = $1
       ORDER BY v.fecha DESC, v.hora_salida DESC, s.id DESC`,
      [req.usuario.id],
    )
    res.json(rows)
  } catch (e) { next(e) }
}

// El cliente retira su solicitud pendiente o cancela una aceptada (libera el cupo) antes de que el viaje inicie.
export async function cancelar(req, res, next) {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })

  await conTransaccion(res, next, async (db) => {
    const { rows } = await db.query(
      `SELECT s.estado, s.viaje_id FROM solicitudes_viaje s
       JOIN clientes c ON c.id = s.cliente_id
       WHERE s.id = $1 AND c.usuario_id = $2 FOR UPDATE OF s`,
      [id, req.usuario.id],
    )
    const solicitud = rows[0]
    if (!solicitud) return abortar(404, 'No se encontró la solicitud')
    if (solicitud.estado === 'cancelada') return abortar(409, 'Esta solicitud ya está cancelada')
    if (solicitud.estado === 'rechazada') return abortar(409, 'El comisionista rechazó esta solicitud')

    const { rows: viajes } = await db.query(
      `SELECT v.estado, ${INICIO} > (${TZ}) AS antes_del_inicio FROM viajes v WHERE v.id = $1 FOR UPDATE`,
      [solicitud.viaje_id],
    )
    if (viajes[0].estado !== 'programado') return abortar(409, 'Solo se puede cancelar antes de que el viaje inicie')
    if (!viajes[0].antes_del_inicio) return abortar(409, 'No se puede cancelar después del inicio del viaje')

    await db.query(`UPDATE solicitudes_viaje SET estado = 'cancelada', resuelto_en = NOW() WHERE id = $1`, [id])
    return { status: 200, body: { id, estado: 'cancelada' } }
  })
}

// ---------------------------------------------------------------------------
// Comisionista
// ---------------------------------------------------------------------------

// ?estado=pendiente (por defecto) | aceptada | rechazada | cancelada | todas  ; ?tipo=pasajero|encomienda
export async function listarRecibidas(req, res, next) {
  try {
    const estado = String(req.query.estado ?? 'pendiente')
    const tipo = req.query.tipo ? String(req.query.tipo) : null
    if (!['pendiente', 'aceptada', 'rechazada', 'cancelada', 'todas'].includes(estado)) return res.status(400).json({ mensaje: 'El estado indicado no es válido' })
    if (tipo && !['pasajero', 'encomienda'].includes(tipo)) return res.status(400).json({ mensaje: 'El tipo indicado no es válido' })

    const params = [req.usuario.id]
    let filtros = ''
    if (estado !== 'todas') { params.push(estado); filtros += ` AND s.estado = $${params.length}` }
    if (tipo) { params.push(tipo); filtros += ` AND s.tipo = $${params.length}` }
    // Las pendientes de viajes ya cancelados o iniciados no se pueden resolver: no se listan.
    if (estado === 'pendiente') filtros += ` AND v.estado = 'programado' AND ${INICIO} > (${TZ})`

    const { rows } = await query(
      `SELECT s.*, cu.email AS cliente_email,
              v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada, v.duracion_min,
              v.cupo_total, v.estado AS estado_viaje, ${SQL_OCUPADOS} AS ocupados
       FROM solicitudes_viaje s
       JOIN viajes v ON v.id = s.viaje_id
       JOIN clientes c ON c.id = s.cliente_id
       JOIN usuarios cu ON cu.id = c.usuario_id
       WHERE v.usuario_id = $1 ${filtros}
       ORDER BY v.fecha, v.hora_salida, s.id
       LIMIT 300`,
      params,
    )
    res.json(rows)
  } catch (e) { next(e) }
}

function resolver(nuevoEstado) {
  return async function (req, res, next) {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })

    // Motivo del rechazo: opcional, hasta 300 caracteres. Solo se guarda al rechazar.
    let motivo = null
    if (nuevoEstado === 'rechazada' && req.body?.motivo != null) {
      if (typeof req.body.motivo !== 'string') return res.status(400).json({ mensaje: 'El motivo del rechazo no es válido' })
      motivo = req.body.motivo.trim() || null
      if (motivo && motivo.length > 300) return res.status(400).json({ mensaje: 'El motivo del rechazo admite hasta 300 caracteres' })
    }

    await conTransaccion(res, next, async (db) => {
      const { rows: previas } = await db.query(
        `SELECT s.viaje_id FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
         WHERE s.id = $1 AND v.usuario_id = $2`,
        [id, req.usuario.id],
      )
      if (!previas[0]) return abortar(404, 'No se encontró la solicitud')

      // Se bloquea primero el viaje (mismo orden que al crear) y despues la solicitud.
      const { rows: viajes } = await db.query(
        `SELECT v.estado, v.cupo_total, ${INICIO} > (${TZ}) AS antes_del_inicio, ${SQL_OCUPADOS} AS ocupados
         FROM viajes v WHERE v.id = $1 FOR UPDATE OF v`,
        [previas[0].viaje_id],
      )
      const viaje = viajes[0]
      const { rows } = await db.query(
        `SELECT estado, tipo, cantidad_pasajeros FROM solicitudes_viaje WHERE id = $1 FOR UPDATE`,
        [id],
      )
      const solicitud = rows[0]
      if (solicitud.estado !== 'pendiente') return abortar(409, 'Esta solicitud ya fue resuelta o el cliente la retiró')
      if (viaje.estado !== 'programado' || !viaje.antes_del_inicio) {
        return abortar(409, 'Solo se pueden resolver solicitudes de viajes programados que todavía no iniciaron')
      }

      if (nuevoEstado === 'aceptada' && solicitud.tipo === 'pasajero') {
        const libres = Math.max(Number(viaje.cupo_total ?? 0) - viaje.ocupados, 0)
        if (solicitud.cantidad_pasajeros > libres) {
          return abortar(409, `No hay cupo suficiente: quedan ${libres} lugar${libres === 1 ? '' : 'es'} y la solicitud es de ${solicitud.cantidad_pasajeros}`)
        }
      }

      await db.query(`UPDATE solicitudes_viaje SET estado = $2, resuelto_en = NOW(), motivo_rechazo = $3 WHERE id = $1`, [id, nuevoEstado, motivo])
      const { rows: despues } = await db.query(`SELECT ${SQL_OCUPADOS} AS ocupados FROM viajes v WHERE v.id = $1`, [previas[0].viaje_id])
      return { status: 200, body: { id, estado: nuevoEstado, ocupados: despues[0].ocupados, cupo_total: viaje.cupo_total } }
    })
  }
}

export const aceptar = resolver('aceptada')
export const rechazar = resolver('rechazada')
