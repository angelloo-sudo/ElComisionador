// Epica 4: Gestion de Pasajeros.
// La solicitud de los clientes para sumarse a un viaje (US19) vive en solicitudes.controller.js.

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
