import { query } from '../config/db.js'

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

export async function listarEncomiendas(req, res, next) {
  try {
    const id = idValido(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const { rows: viajes } = await query(
      'SELECT id, estado FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, req.usuario.id],
    )
    if (!viajes[0]) return res.status(404).json({ mensaje: 'No se encontró el viaje' })

    const { rows: encomiendas } = await query(
      `SELECT s.id, s.emisor_nombre, s.emisor_apellido, s.receptor_nombre, s.receptor_apellido,
              s.origen_localidad, s.destino_localidad, s.origen_calle, s.origen_altura,
              s.destino_calle, s.destino_altura, s.retirada_en, s.entregada_en,
              s.monto::text AS monto, s.forma_pago
       FROM solicitudes_viaje s
       WHERE s.viaje_id = $1 AND s.tipo = 'encomienda' AND s.estado = 'aceptada'
       ORDER BY s.id`,
      [id],
    )
    res.json({ estado_viaje: viajes[0].estado, encomiendas })
  } catch (e) { next(e) }
}
