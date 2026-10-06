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
             FROM pasajeros p
             JOIN viaje_pasajero vp ON vp.pasajero_id = p.id
             JOIN viajes v ON v.id = vp.viaje_id
             WHERE p.cliente_id = c.id AND v.usuario_id = $1
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