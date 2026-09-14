// Epica 5: Ingresos, Gastos y Rentabilidad.
// import { query } from '../config/db.js'

export async function registrarIngreso(req, res, next) {
  try { res.status(501).json({ mensaje: 'registrar ingreso: pendiente', body: req.body }) }
  catch (e) { next(e) }
}

export async function registrarGasto(req, res, next) {
  try { res.status(501).json({ mensaje: 'registrar gasto: pendiente', body: req.body }) }
  catch (e) { next(e) }
}

export async function gananciaViaje(req, res, next) {
  try { res.status(501).json({ mensaje: `ganancia del viaje ${req.params.viajeId}: pendiente` }) }
  catch (e) { next(e) }
}

export async function rentabilidad(req, res, next) {
  try { res.status(501).json({ mensaje: 'rentabilidad general: pendiente' }) }
  catch (e) { next(e) }
}
