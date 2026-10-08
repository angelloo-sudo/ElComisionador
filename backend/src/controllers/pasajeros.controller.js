// Epica 4: Gestion de Pasajeros.
import { pool, query } from '../config/db.js'

export async function listarViajesDisponibles(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha,
              v.hora_salida, v.hora_llegada, v.cupo_total,
              u.nombre AS comisionista_nombre, u.apellido AS comisionista_apellido,
              (SELECT COUNT(*)::int
               FROM viaje_pasajero vp
               WHERE vp.viaje_id = v.id AND vp.estado = 'activo') AS ocupados,
              (v.cupo_total - (SELECT COUNT(*)::int
               FROM viaje_pasajero vp
               WHERE vp.viaje_id = v.id AND vp.estado = 'activo')) AS cupos_disponibles
       FROM viajes v
       JOIN usuarios u ON u.id = v.usuario_id
       JOIN clientes c ON c.usuario_id = $1
       WHERE v.estado = 'programado'
         AND u.rol = 'comisionista' AND u.activo = true
         AND v.cupo_total > 0
         AND (v.fecha + COALESCE(v.hora_salida, TIME '00:00'))
             > (NOW() AT TIME ZONE 'America/Argentina/Cordoba')
         AND (SELECT COUNT(*) FROM viaje_pasajero vp
              WHERE vp.viaje_id = v.id AND vp.estado = 'activo') < v.cupo_total
         AND NOT EXISTS (
           SELECT 1
           FROM pasajeros p
           JOIN viaje_pasajero vp ON vp.pasajero_id = p.id
           WHERE p.cliente_id = c.id AND vp.viaje_id = v.id AND vp.estado = 'activo'
         )
       ORDER BY v.fecha, v.hora_salida, v.id`,
      [req.usuario.id],
    )
    res.json(rows)
  } catch (e) { next(e) }
}

export async function reservarViaje(req, res, next) {
  const viajeId = Number(req.params.viajeId)
  if (!Number.isSafeInteger(viajeId) || viajeId < 1) {
    return res.status(400).json({ mensaje: 'El viaje solicitado no es válido' })
  }

  let cliente
  let transaccionIniciada = false

  try {
    cliente = await pool.connect()
    await cliente.query('BEGIN')
    transaccionIniciada = true

    const { rows: viajes } = await cliente.query(
      `SELECT id, estado, fecha::text AS fecha, hora_salida, cupo_total
       FROM viajes WHERE id = $1 FOR UPDATE`,
      [viajeId],
    )
    const viaje = viajes[0]
    if (!viaje) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(404).json({ mensaje: 'No se encontró el viaje solicitado' })
    }
    if (viaje.estado !== 'programado') {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'Solo se pueden reservar viajes programados' })
    }

    const { rows: inicio } = await cliente.query(
      `SELECT ($1::date + COALESCE($2::time, TIME '00:00'))
                > (NOW() AT TIME ZONE 'America/Argentina/Cordoba') AS antes_del_inicio`,
      [viaje.fecha, viaje.hora_salida],
    )
    if (!inicio[0].antes_del_inicio) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'No se puede reservar un viaje que ya inició' })
    }

    const { rows: clientes } = await cliente.query(
      `SELECT c.id AS cliente_id, u.nombre, u.apellido, c.telefono
       FROM clientes c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.usuario_id = $1 AND u.activo = true
       FOR UPDATE OF c`,
      [req.usuario.id],
    )
    const perfilCliente = clientes[0]
    if (!perfilCliente) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(404).json({ mensaje: 'No se encontró el perfil de cliente' })
    }

    const { rows: reservas } = await cliente.query(
      `SELECT vp.pasajero_id, vp.estado
       FROM viaje_pasajero vp
       JOIN pasajeros p ON p.id = vp.pasajero_id
       WHERE vp.viaje_id = $1 AND p.cliente_id = $2
       ORDER BY vp.pasajero_id
       FOR UPDATE OF vp`,
      [viajeId, perfilCliente.cliente_id],
    )
    if (reservas.some((reserva) => reserva.estado === 'activo')) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'Ya tenés una reserva activa para este viaje' })
    }

    const { rows: ocupacion } = await cliente.query(
      `SELECT COUNT(*)::int AS ocupados
       FROM viaje_pasajero WHERE viaje_id = $1 AND estado = 'activo'`,
      [viajeId],
    )
    if (Number(ocupacion[0].ocupados) >= Number(viaje.cupo_total ?? 0)) {
      await cliente.query('ROLLBACK')
      transaccionIniciada = false
      return res.status(409).json({ mensaje: 'El viaje ya no tiene cupos disponibles' })
    }

    let pasajeroId = reservas[0]?.pasajero_id
    if (pasajeroId) {
      await cliente.query(
        `UPDATE viaje_pasajero SET estado = 'activo'
         WHERE viaje_id = $1 AND pasajero_id = $2`,
        [viajeId, pasajeroId],
      )
    } else {
      const { rows: pasajeros } = await cliente.query(
        `INSERT INTO pasajeros (cliente_id, nombre, telefono)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          perfilCliente.cliente_id,
          `${perfilCliente.nombre} ${perfilCliente.apellido ?? ''}`.trim(),
          perfilCliente.telefono,
        ],
      )
      pasajeroId = pasajeros[0].id
      await cliente.query(
        `INSERT INTO viaje_pasajero (viaje_id, pasajero_id, estado)
         VALUES ($1, $2, 'activo')`,
        [viajeId, pasajeroId],
      )
    }

    await cliente.query('COMMIT')
    transaccionIniciada = false
    res.status(201).json({ viaje_id: viajeId, pasajero_id: pasajeroId, estado: 'activo' })
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
