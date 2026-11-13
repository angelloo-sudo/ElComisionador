import { interpretarBusquedaViajes } from '../services/busqueda-viajes-ia.service.js'

export async function interpretar(req, res, next) {
  try {
    const filtros = await interpretarBusquedaViajes(req.body?.mensaje)
    res.json({ filtros })
  } catch (error) {
    if (Number.isInteger(error.status)) {
      return res.status(error.status).json({ mensaje: error.message })
    }
    next(error)
  }
}
