// Epica 4: Gestion de Pasajeros.
import { pool, query } from '../config/db.js'

export async function listarMisTraslados(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT v.id AS viaje_id, p.id AS pasajero_id, p.nombre AS pasajero_nombre,
              v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.hora_llegada,
              v.estado AS estado_viaje, vp.estado AS estado_traslado,
              vp.punto_ascenso, vp.punto_descenso, vp.monto,
              (vp.estado = 'activo' AND v.estado = 'programado'
               AND (v.fecha + COALESCE(v.hora_salida, TIME '00:00'))
                   > (NOW() AT TIME ZONE 'America/Argentina/Cordoba')) AS puede_cancelar
       FROM clientes c
       JOIN pasajeros p ON p.cliente_id = c.id
       JOIN viaje_pasajero vp ON vp.pasajero_id = p.id
       JOIN viajes v ON v.id = vp.viaje_id
       WHERE c.usuario_id = $1
       ORDER BY v.fecha DESC, v.hora_salida DESC, p.id`,
      [req.usuario.id],
    )
    res.json(rows)
  } catch (e) { next(e) }
}

export async function cancelarMiTraslado(req, res, next) {
  const viajeId = Number(req.params.viajeId)
  const pasajeroId = Number(req.params.pasajeroId)
  if (!Number.isSafeInteger(viajeId) || viajeId < 1 || !Number.isSafeInteger(pasajeroId) || pasajeroId < 1) {
    return res.status(400).json({ mensaje: 'El traslado solicitado no es válido' })
  }

  let cliente
  let transaccionIniciada = false

  try {
    cliente = await pool.connect()
    await cliente.query('BEGIN')
    transaccionIniciada = true

    const { rows: viajes } = await cliente.query(
      `SELECT estado, fecha::text AS fecha, hora_salida
       FROM viajes WHERE id = $1 FOR UPDATE`,
      [viajeId],
    )
    const viaje = viajes[0]
    if (!viaje) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(404).json({ mensaje: 'No se encontró el traslado solicitado' })
    }

    const { rows: asociaciones } = await cliente.query(
      `SELECT vp.estado
       FROM viaje_pasajero vp
       JOIN pasajeros p ON p.id = vp.pasajero_id
       JOIN clientes c ON c.id = p.cliente_id
       WHERE vp.viaje_id = $1 AND vp.pasajero_id = $2 AND c.usuario_id = $3
       FOR UPDATE OF vp`,
      [viajeId, pasajeroId, req.usuario.id],
    )
    const asociacion = asociaciones[0]
    if (!asociacion) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(404).json({ mensaje: 'No se encontró una reserva tuya para este traslado' })
    }
    if (asociacion.estado !== 'activo') {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'Este traslado ya está cancelado' })
    }
    if (viaje.estado !== 'programado') {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'Solo se puede cancelar un traslado antes de que el viaje inicie' })
    }

    const { rows: inicio } = await cliente.query(
      `SELECT ($1::date + COALESCE($2::time, TIME '00:00'))
                > (NOW() AT TIME ZONE 'America/Argentina/Cordoba') AS antes_del_inicio`,
      [viaje.fecha, viaje.hora_salida],
    )
    if (!inicio[0].antes_del_inicio) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'No se puede cancelar el traslado después del inicio del viaje' })
    }

    await cliente.query(
      `UPDATE viaje_pasajero SET estado = 'cancelado'
       WHERE viaje_id = $1 AND pasajero_id = $2`,
      [viajeId, pasajeroId],
    )
    await cliente.query('COMMIT')
    transaccionIniciada = false
    res.json({ viaje_id: viajeId, pasajero_id: pasajeroId, estado: 'cancelado' })
  } catch (e) {
    if (cliente && transaccionIniciada) {
      try {
        await cliente.query('ROLLBACK')
      } catch (errorRollback) {
        return next(errorRollback)
      }
    }
    next(e)
  } finally {
    cliente?.release()
  }
}

export async function listar(req, res, next) {
  try { res.status(501).json({ mensaje: 'listar pasajeros: pendiente' }) }
  catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try { res.status(501).json({ mensaje: 'crear pasajero: pendiente', body: req.body }) }
  catch (e) { next(e) }
}

export async function asignarAViaje(req, res, next) {
  try { res.status(501).json({ mensaje: 'asignar pasajero a viaje: pendiente' }) }
  catch (e) { next(e) }
}

export async function cupos(req, res, next) {
  try { res.status(501).json({ mensaje: `cupos del viaje ${req.params.viajeId}: pendiente` }) }
  catch (e) { next(e) }
}
