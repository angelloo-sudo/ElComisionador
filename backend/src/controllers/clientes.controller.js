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
      `SELECT u.id, u.nombre, u.apellido, u.email, c.dni, c.telefono
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

    res.json({ cliente })
  } catch (e) { next(e) }
}
