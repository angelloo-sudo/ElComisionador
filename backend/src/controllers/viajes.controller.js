// Epica 2: Gestion de Viajes.
import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      `SELECT * FROM viajes
       WHERE usuario_id = $1
       ORDER BY fecha, hora_salida`,
      [usuarioId]
    )

    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const resultado = await query(
      'SELECT * FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    res.status(200).json(resultado.rows[0])
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { origen, destino, fecha, hora_salida, cupo_total } = req.body
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, cupo_total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [usuarioId, origen, destino, fecha, hora_salida || null, cupo_total ?? 0]
    )

    res.status(201).json(rows[0])
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `actualizar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}
