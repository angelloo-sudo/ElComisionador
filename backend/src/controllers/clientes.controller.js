// Epica 1: Gestion de Clientes.
// Patron de referencia: replicar esta estructura en los demas controladores.
// import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    // const { rows } = await query('SELECT * FROM clientes ORDER BY nombre')
    // res.json(rows)
    res.status(501).json({ mensaje: 'listar clientes: pendiente' })
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    res.status(501).json({ mensaje: `obtener cliente ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'crear cliente: pendiente', body: req.body })
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `actualizar cliente ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar cliente ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}
