import { obtenerLocalidades } from '../services/localidades.service.js'

// Lista de localidades de Cordoba para el desplegable de origen/destino.
export function listar(req, res, next) {
  try {
    const datos = obtenerLocalidades()
    if (!datos) {
      return res.status(503).json({
        mensaje: 'La lista de localidades todavía no fue generada. Ejecutá "npm --prefix backend run localidades".',
      })
    }
    res.json(datos.lista)
  } catch (e) { next(e) }
}
