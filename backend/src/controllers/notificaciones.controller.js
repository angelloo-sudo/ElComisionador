import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, viaje_id, titulo, mensaje, leida_en, creado_en
       FROM notificaciones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 100`,
      [req.usuario.id],
    )
    res.json(rows)
  } catch (error) { next(error) }
}

export async function marcarLeida(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE notificaciones SET leida_en = COALESCE(leida_en, NOW())
       WHERE id = $1 AND usuario_id = $2 RETURNING id, leida_en`,
      [req.params.id, req.usuario.id],
    )
    if (!rows.length) return res.status(404).json({ mensaje: 'Notificación no encontrada' })
    res.json(rows[0])
  } catch (error) { next(error) }
}
