import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT DISTINCT u.id, u.nombre, u.apellido, u.email, c.dni, c.telefono
       FROM clientes c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE u.activo = true
         AND (
           EXISTS (
             SELECT 1
             FROM solicitudes_viaje s
             JOIN viajes v ON v.id = s.viaje_id
             WHERE s.cliente_id = c.id AND v.usuario_id = $1 AND s.estado = 'aceptada'
           )
           OR EXISTS (
             SELECT 1
             FROM encomiendas e
             JOIN viajes v ON v.id = e.viaje_id
             WHERE e.cliente_remitente_id = c.id AND v.usuario_id = $1
           )
         )
       ORDER BY u.apellido NULLS LAST, u.nombre`,
      [req.usuario.id],
    )

    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const usuarioId = Number(req.params.id)
    if (!Number.isSafeInteger(usuarioId) || usuarioId < 1) {
      return res.status(400).json({ mensaje: 'El cliente indicado no es válido' })
    }

    const { rows: clientes } = await query(
      `SELECT u.id, u.nombre, u.apellido, u.email, c.id AS cliente_id, c.dni, c.telefono
       FROM clientes c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE u.id = $1 AND u.activo = true
         AND (
           EXISTS (
             SELECT 1
             FROM solicitudes_viaje s
             JOIN viajes v ON v.id = s.viaje_id
             WHERE s.cliente_id = c.id AND v.usuario_id = $2 AND s.estado = 'aceptada'
           )
           OR EXISTS (
             SELECT 1
             FROM encomiendas e
             JOIN viajes v ON v.id = e.viaje_id
             WHERE e.cliente_remitente_id = c.id AND v.usuario_id = $2
           )
         )`,
      [usuarioId, req.usuario.id],
    )
    const cliente = clientes[0]
    if (!cliente) return res.status(404).json({ mensaje: 'No se encontró el cliente vinculado a tus viajes' })

    const [solicitudes, encomiendas] = await Promise.all([
      query(
        `SELECT s.id, s.tipo, s.estado, s.origen_calle, s.origen_altura, s.origen_barrio,
                s.origen_descripcion, s.destino_calle, s.destino_altura, s.destino_barrio,
                s.nombre, s.apellido, s.dni, s.telefono, s.cantidad_pasajeros,
                s.emisor_nombre, s.emisor_apellido, s.emisor_telefono,
                s.receptor_nombre, s.receptor_apellido, s.receptor_telefono,
                v.id AS viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino,
                v.fecha::text AS viaje_fecha, v.hora_salida
         FROM solicitudes_viaje s
         JOIN viajes v ON v.id = s.viaje_id
         WHERE s.cliente_id = $1 AND v.usuario_id = $2
         ORDER BY v.fecha DESC, s.id DESC`,
        [cliente.cliente_id, req.usuario.id],
      ),
      query(
        `SELECT e.id, e.remitente_nombre, e.remitente_telefono, e.direccion_retiro,
                e.destinatario_nombre, e.destinatario_telefono, e.destinatario_direccion,
                e.estado, v.id AS viaje_id, v.origen AS viaje_origen,
                v.destino AS viaje_destino, v.fecha::text AS viaje_fecha, v.hora_salida
         FROM encomiendas e
         JOIN viajes v ON v.id = e.viaje_id
         WHERE e.cliente_remitente_id = $1 AND v.usuario_id = $2
         ORDER BY e.fecha_solicitud DESC, e.id DESC`,
        [cliente.cliente_id, req.usuario.id],
      ),
    ])

    const { cliente_id, ...datosCliente } = cliente
    res.json({ cliente: datosCliente, solicitudes: solicitudes.rows, encomiendas: encomiendas.rows })
  } catch (e) { next(e) }
}
