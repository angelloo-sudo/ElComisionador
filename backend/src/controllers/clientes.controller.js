// Epica 1: Gestion de Clientes.
// Patron de referencia: replicar esta estructura en los demas controladores.
import { query } from '../config/db.js'

export async function listar(req, res, next) {
   try {
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      `SELECT * FROM clientes
       WHERE usuario_id = $1 AND activo = true
       ORDER BY apellido, nombre`,
      [usuarioId]
    )

    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const { id } = req.params
    const resultado = await query('SELECT * FROM clientes WHERE id = $1', [id])
    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: `Cliente ${id} no encontrado` })
    }
    res.status(200).json(resultado.rows[0])
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { nombre, apellido, dni, telefono, barrio, calle, altura, descripcion } = req.body
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      `INSERT INTO clientes (usuario_id, nombre, apellido, dni, telefono, barrio, calle, altura, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [usuarioId, nombre, apellido, dni ?? null, telefono ?? null, barrio ?? null, calle ?? null, altura ?? null, descripcion ?? null]
    )

    res.status(201).json(rows[0])
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    const { id } = req.params
    const { nombre, apellido, dni, telefono, barrio, calle, altura, descripcion } = req.body

    const { rows } = await query(
      `UPDATE clientes
       SET nombre = $1, apellido = $2, dni = $3, telefono = $4,
           barrio = $5, calle = $6, altura = $7, descripcion = $8
       WHERE id = $9 AND activo = true
       RETURNING *`,
      [nombre, apellido, dni ?? null, telefono ?? null, barrio ?? null, calle ?? null, altura ?? null, descripcion ?? null, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' })
    }

    res.json(rows[0])
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    const { id } = req.params

    const resultado = await query(
      `UPDATE clientes
       SET activo = false
       WHERE id = $1 AND activo = true RETURNING *`,
      [id]
    )
    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: `Cliente ${id} no encontrado o ya esta dado de baja` })
    }

    res.status(200).json({ mensaje: `Cliente dado de baja correctamente`, cliente: resultado.rows[0] })
     } catch (e) { next(e) }

}
