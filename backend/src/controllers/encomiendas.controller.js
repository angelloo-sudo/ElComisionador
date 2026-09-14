// Epica 3: Gestion de Encomiendas (nucleo del sistema).
// Estados posibles: 'recibido' | 'en_viaje' | 'entregado' (US13).
// import { query } from '../config/db.js'

export async function listar(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'listar encomiendas: pendiente' })
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    res.status(501).json({ mensaje: `obtener encomienda ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'crear encomienda: pendiente', body: req.body })
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `actualizar encomienda ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function cambiarEstado(req, res, next) {
  try {
    const { estado } = req.body
    res.status(501).json({ mensaje: `cambiar estado de ${req.params.id} a ${estado}: pendiente` })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar encomienda ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}
