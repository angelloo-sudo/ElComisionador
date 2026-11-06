import { query } from '../config/db.js'
import { agregarFiltroFechas } from '../utils/historial-filtros.js'

function textoFiltro(valor, nombre, max = 120) {
  if (valor == null || valor === '') return { valor: null }
  if (typeof valor !== 'string' || valor.trim().length > max) return { error: `El filtro ${nombre} no es válido` }
  return { valor: valor.trim() }
}

function idValido(raw) {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function listarViajes(req, res, next) {
  try {
    const params = [req.usuario.id]
    const fechas = agregarFiltroFechas(req.query, 'v.fecha', params)
    if (fechas.error) return res.status(400).json({ mensaje: fechas.error })
    const origen = textoFiltro(req.query.origen, 'origen')
    const destino = textoFiltro(req.query.destino, 'destino')
    if (origen.error || destino.error) return res.status(400).json({ mensaje: origen.error ?? destino.error })
    const condiciones = [...fechas.clauses]
    if (origen.valor) { params.push(`%${origen.valor}%`); condiciones.push(`v.origen ILIKE $${params.length}`) }
    if (destino.valor) { params.push(`%${destino.valor}%`); condiciones.push(`v.destino ILIKE $${params.length}`) }
    const { rows } = await query(
      `SELECT v.id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada,
              v.distancia_km, v.duracion_min, v.cupo_total, v.estado, v.iniciado_en, v.finalizado_en,
              COALESCE((SELECT json_agg(json_build_object('id', p.id, 'orden', p.orden, 'localidad', p.localidad,
                'hora_estimada', to_char(p.hora_estimada, 'HH24:MI')) ORDER BY p.orden)
                FROM paradas_viaje p WHERE p.viaje_id = v.id), '[]'::json) AS paradas
       FROM viajes v WHERE v.usuario_id = $1 ${condiciones.length ? `AND ${condiciones.join(' AND ')}` : ''}
       ORDER BY v.fecha DESC, v.hora_salida DESC NULLS LAST, v.id DESC`, params)
    res.json({ viajes: rows })
  } catch (e) { next(e) }
}

export async function obtenerViaje(req, res, next) {
  const id = idValido(req.params.id)
  if (!id) return res.status(400).json({ mensaje: 'El viaje no es válido' })
  try {
    const { rows } = await query(
      `SELECT v.id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada,
              v.distancia_km, v.duracion_min, v.cupo_total, v.estado, v.serie_id, v.repeticion_dias,
              v.iniciado_en, v.finalizado_en, v.creado_en,
              COALESCE((SELECT json_agg(json_build_object('id', p.id, 'orden', p.orden, 'localidad', p.localidad,
                'hora_estimada', to_char(p.hora_estimada, 'HH24:MI')) ORDER BY p.orden)
                FROM paradas_viaje p WHERE p.viaje_id = v.id), '[]'::json) AS paradas
       FROM viajes v WHERE v.id = $1 AND v.usuario_id = $2`, [id, req.usuario.id])
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró el viaje' })
    res.json({ viaje: rows[0] })
  } catch (e) { next(e) }
}

export async function listarClientes(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT DISTINCT c.id, u.nombre, u.apellido
       FROM clientes c JOIN usuarios u ON u.id = c.usuario_id
       WHERE EXISTS (SELECT 1 FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
                     WHERE s.cliente_id = c.id AND v.usuario_id = $1)
          OR EXISTS (SELECT 1 FROM encomiendas e JOIN viajes v ON v.id = e.viaje_id
                     WHERE e.cliente_remitente_id = c.id AND v.usuario_id = $1)
       ORDER BY u.apellido NULLS LAST, u.nombre, c.id`, [req.usuario.id])
    res.json({ clientes: rows })
  } catch (e) { next(e) }
}

export async function listarOperacionesCliente(req, res, next) {
  const clienteId = idValido(req.params.clienteId)
  if (!clienteId) return res.status(400).json({ mensaje: 'El cliente no es válido' })
  const tipo = req.query.tipo ?? 'todos'
  if (!['todos', 'pasajero', 'encomienda'].includes(tipo)) return res.status(400).json({ mensaje: 'El tipo de operación no es válido' })
  try {
    const params = [req.usuario.id, clienteId]
    const fechas = agregarFiltroFechas(req.query, 'fecha_operacion', params)
    if (fechas.error) return res.status(400).json({ mensaje: fechas.error })
    const whereFechas = fechas.clauses.length ? `AND ${fechas.clauses.join(' AND ')}` : ''
    const tipoClause = tipo === 'todos' ? '' : `AND tipo = $${params.push(tipo)}`
    const { rows } = await query(
      `SELECT * FROM (
         SELECT s.id, s.tipo, v.fecha AS fecha_operacion, v.fecha::text AS fecha, v.origen, v.destino,
                COALESCE(s.origen_localidad, v.origen) AS origen_localidad,
                COALESCE(s.destino_localidad, v.destino) AS destino_localidad,
                s.estado, s.estado_pasajero, v.id AS viaje_id,
                CASE WHEN s.tipo = 'pasajero' THEN 'Reserva de traslado #' || s.id::text
                     ELSE 'Solicitud de encomienda #' || s.id::text END AS descripcion
         FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
         WHERE v.usuario_id = $1 AND s.cliente_id = $2
         UNION ALL
         SELECT e.id, 'encomienda'::varchar AS tipo, e.fecha_solicitud::date AS fecha_operacion,
                e.fecha_solicitud::date::text AS fecha, v.origen, v.destino, NULL::varchar AS origen_localidad,
                NULL::varchar AS destino_localidad, e.estado, NULL::varchar AS estado_pasajero,
                v.id AS viaje_id, 'Encomienda #' || e.id::text AS descripcion
         FROM encomiendas e JOIN viajes v ON v.id = e.viaje_id
         WHERE v.usuario_id = $1 AND e.cliente_remitente_id = $2
       ) operaciones WHERE true ${whereFechas} ${tipoClause}
       ORDER BY fecha_operacion DESC, id DESC`, params)
    // No revelar si existe un cliente fuera del ámbito del comisionista.
    if (!rows.length) {
      const pertenece = await query(
        `SELECT 1 FROM clientes c WHERE c.id = $1 AND (
          EXISTS (SELECT 1 FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id WHERE s.cliente_id=c.id AND v.usuario_id=$2)
          OR EXISTS (SELECT 1 FROM encomiendas e JOIN viajes v ON v.id=e.viaje_id WHERE e.cliente_remitente_id=c.id AND v.usuario_id=$2))`,
        [clienteId, req.usuario.id])
      if (!pertenece.rowCount) return res.status(404).json({ mensaje: 'No se encontró el cliente' })
    }
    res.json({ operaciones: rows })
  } catch (e) { next(e) }
}

export async function listarEncomiendas(req, res, next) {
  try {
    const params = [req.usuario.id]
    const fechas = agregarFiltroFechas(req.query, 'fecha_filtro', params)
    if (fechas.error) return res.status(400).json({ mensaje: fechas.error })
    const condiciones = [...fechas.clauses]
    if (req.query.estado) {
      if (!['pendiente', 'aceptada', 'rechazada', 'cancelada', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'].includes(req.query.estado)) return res.status(400).json({ mensaje: 'El estado no es válido' })
      params.push(req.query.estado); condiciones.push(`estado = $${params.length}`)
    }
    for (const [key, col] of [['origen', 'origen_localidad'], ['destino', 'destino_localidad']]) {
      const f = textoFiltro(req.query[key], key)
      if (f.error) return res.status(400).json({ mensaje: f.error })
      if (f.valor) { params.push(`%${f.valor}%`); condiciones.push(`${col} ILIKE $${params.length}`) }
    }
    const { rows } = await query(
      `SELECT * FROM (
         SELECT e.id, 'encomienda'::varchar AS origen_registro, e.cliente_remitente_id AS cliente_id,
                COALESCE(NULLIF(concat_ws(' ', u.nombre, u.apellido), ''), e.remitente_nombre) AS cliente,
                e.remitente_nombre, e.remitente_telefono, e.direccion_retiro,
                e.destinatario_nombre, e.destinatario_telefono, e.destinatario_direccion,
                e.tipo_contenido, e.peso_kg, e.dimensiones, e.fragil, e.descripcion,
                NULL::varchar AS origen_localidad, NULL::varchar AS destino_localidad,
                e.fecha_solicitud::date AS fecha_filtro, e.fecha_solicitud::date::text AS fecha, e.estado, e.viaje_id,
                v.fecha::text AS fecha_viaje, v.origen AS viaje_origen, v.destino AS viaje_destino
         FROM encomiendas e JOIN viajes v ON v.id=e.viaje_id AND v.usuario_id=$1
         LEFT JOIN clientes c ON c.id=e.cliente_remitente_id LEFT JOIN usuarios u ON u.id=c.usuario_id
         UNION ALL
         SELECT s.id, 'solicitud'::varchar AS origen_registro, s.cliente_id,
                concat_ws(' ', u.nombre, u.apellido) AS cliente,
                concat_ws(' ', s.emisor_nombre, s.emisor_apellido) AS remitente_nombre,
                s.emisor_telefono AS remitente_telefono,
                concat_ws(' ', s.origen_calle, s.origen_altura, s.origen_codigo_postal) AS direccion_retiro,
                concat_ws(' ', s.receptor_nombre, s.receptor_apellido) AS destinatario_nombre,
                s.receptor_telefono AS destinatario_telefono,
                concat_ws(' ', s.destino_calle, s.destino_altura, s.destino_codigo_postal) AS destinatario_direccion,
                s.tipo_contenido, s.peso_kg, NULL::varchar AS dimensiones, s.fragil,
                s.contenido_descripcion AS descripcion, s.origen_localidad, s.destino_localidad,
                s.creado_en::date AS fecha_filtro, s.creado_en::date::text AS fecha, s.estado, s.viaje_id,
                v.fecha::text AS fecha_viaje, v.origen AS viaje_origen, v.destino AS viaje_destino
         FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id AND v.usuario_id=$1
         JOIN clientes c ON c.id=s.cliente_id JOIN usuarios u ON u.id=c.usuario_id
         WHERE s.tipo='encomienda'
       ) envios ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
       ORDER BY fecha DESC, id DESC, origen_registro`, params)
    res.json({ encomiendas: rows })
  } catch (e) { next(e) }
}

export async function obtenerEncomienda(req, res, next) {
  const id = idValido(req.params.id)
  if (!id) return res.status(400).json({ mensaje: 'La encomienda no es válida' })
  try {
    if (req.params.origenRegistro === 'solicitud') {
      const { rows } = await query(
        `SELECT s.id, 'solicitud'::varchar AS origen_registro, s.cliente_id,
                concat_ws(' ', u.nombre, u.apellido) AS cliente,
                concat_ws(' ', s.emisor_nombre, s.emisor_apellido) AS remitente_nombre,
                s.emisor_telefono AS remitente_telefono,
                concat_ws(' ', s.origen_calle, s.origen_altura, s.origen_codigo_postal) AS direccion_retiro,
                concat_ws(' ', s.receptor_nombre, s.receptor_apellido) AS destinatario_nombre,
                s.receptor_telefono AS destinatario_telefono,
                concat_ws(' ', s.destino_calle, s.destino_altura, s.destino_codigo_postal) AS destinatario_direccion,
                s.tipo_contenido, s.peso_kg, s.fragil, s.contenido_descripcion AS descripcion,
                s.origen_localidad, s.destino_localidad, s.creado_en AS fecha_solicitud, s.estado,
                s.viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS fecha_viaje,
                v.hora_salida, v.hora_llegada, v.estado AS estado_viaje,
                COALESCE((SELECT json_agg(json_build_object('id', h.id, 'estado', h.estado, 'fecha_hora', h.fecha_hora)
                  ORDER BY h.fecha_hora, h.id) FROM historial_solicitudes_encomienda h WHERE h.solicitud_id=s.id), '[]'::json) AS historial
         FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id AND v.usuario_id=$2
         JOIN clientes c ON c.id=s.cliente_id JOIN usuarios u ON u.id=c.usuario_id
         WHERE s.id=$1 AND s.tipo='encomienda'`, [id, req.usuario.id])
      if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró la encomienda' })
      return res.json({ encomienda: rows[0], recorrido_particular_disponible: true, historial_disponible: true })
    }
    const { rows } = await query(
      `SELECT e.id, 'encomienda'::varchar AS origen_registro, e.cliente_remitente_id AS cliente_id, COALESCE(NULLIF(concat_ws(' ', u.nombre, u.apellido), ''), e.remitente_nombre) AS cliente,
              e.remitente_nombre, e.remitente_telefono, e.direccion_retiro, e.destinatario_nombre,
              e.destinatario_telefono, e.destinatario_direccion, e.tipo_contenido, e.peso_kg,
              e.dimensiones, e.fragil, e.descripcion, e.fecha_solicitud, e.estado, e.estado_pago,
              e.viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS fecha_viaje,
              v.hora_salida, v.hora_llegada, v.estado AS estado_viaje,
              COALESCE((SELECT json_agg(json_build_object('id', h.id, 'estado', h.estado, 'fecha_hora', h.fecha_hora)
                ORDER BY h.fecha_hora, h.id) FROM historial_encomiendas h WHERE h.encomienda_id=e.id), '[]'::json) AS historial
       FROM encomiendas e JOIN viajes v ON v.id=e.viaje_id AND v.usuario_id=$2
       LEFT JOIN clientes c ON c.id=e.cliente_remitente_id LEFT JOIN usuarios u ON u.id=c.usuario_id
       WHERE e.id=$1`, [id, req.usuario.id])
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró la encomienda' })
    res.json({ encomienda: rows[0], recorrido_particular_disponible: false, historial_disponible: true })
  } catch (e) { next(e) }
}

export async function listarPasajeros(req, res, next) {
  try {
    const params = [req.usuario.id]
    const fechas = agregarFiltroFechas(req.query, 'v.fecha', params)
    if (fechas.error) return res.status(400).json({ mensaje: fechas.error })
    const condiciones = [...fechas.clauses, `s.tipo = 'pasajero'`]
    const nombre = textoFiltro(req.query.nombre, 'nombre/apellido')
    if (nombre.error) return res.status(400).json({ mensaje: nombre.error })
    if (nombre.valor) { params.push(`%${nombre.valor}%`); condiciones.push(`concat_ws(' ', s.nombre, s.apellido) ILIKE $${params.length}`) }
    for (const [key, col] of [['origen', 'COALESCE(s.origen_localidad, v.origen)'], ['destino', 'COALESCE(s.destino_localidad, v.destino)']]) {
      const f = textoFiltro(req.query[key], key)
      if (f.error) return res.status(400).json({ mensaje: f.error })
      if (f.valor) { params.push(`%${f.valor}%`); condiciones.push(`${col} ILIKE $${params.length}`) }
    }
    const { rows } = await query(
      `SELECT s.id AS solicitud_id, s.nombre, s.apellido,
              COALESCE(s.origen_localidad, v.origen) AS origen_localidad,
              COALESCE(s.destino_localidad, v.destino) AS destino_localidad,
              v.id AS viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino,
              v.fecha::text AS fecha, v.hora_salida, v.hora_llegada, v.estado AS estado_viaje,
              s.estado AS estado_reserva, s.estado_pasajero, s.cantidad_pasajeros,
              s.lleva_equipaje, s.equipaje_detalle, s.forma_pago, s.creado_en, s.resuelto_en,
              s.subio_en, s.llego_en
       FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id AND v.usuario_id=$1
       WHERE ${condiciones.join(' AND ')}
       ORDER BY v.fecha DESC, v.hora_salida DESC NULLS LAST, s.id DESC`, params)
    res.json({ pasajeros: rows })
  } catch (e) { next(e) }
}

export async function obtenerPasajero(req, res, next) {
  const id = idValido(req.params.solicitudId)
  if (!id) return res.status(400).json({ mensaje: 'La reserva no es válida' })
  try {
    const { rows } = await query(
      `SELECT s.id AS solicitud_id, s.nombre, s.apellido, s.origen_localidad, s.destino_localidad,
              s.cantidad_pasajeros, s.lleva_equipaje, s.equipaje_detalle, s.forma_pago, s.estado AS estado_reserva,
              s.estado_pasajero, s.creado_en, s.resuelto_en, s.subio_en, s.llego_en,
              v.id AS viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS fecha,
              v.hora_salida, v.hora_llegada, v.estado AS estado_viaje, v.distancia_km, v.duracion_min,
              COALESCE((SELECT json_agg(json_build_object('orden', p.orden, 'localidad', p.localidad,
                'hora_estimada', to_char(p.hora_estimada, 'HH24:MI')) ORDER BY p.orden)
                FROM paradas_viaje p WHERE p.viaje_id=v.id), '[]'::json) AS paradas
       FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id AND v.usuario_id=$2
       WHERE s.id=$1 AND s.tipo='pasajero'`, [id, req.usuario.id])
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró la reserva' })
    res.json({ pasajero: rows[0] })
  } catch (e) { next(e) }
}
