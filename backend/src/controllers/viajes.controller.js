// Epica 2: Gestion de Viajes.
// import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'listar viajes: pendiente' })
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    res.status(501).json({ mensaje: `obtener viaje ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'crear viaje: pendiente', body: req.body })
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `actualizar viaje ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar viaje ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}
