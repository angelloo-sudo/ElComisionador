// Paradas de un viaje (ver services/paradas.service.js).
//  - Comisionista: ve las paradas de sus solicitudes aceptadas y pendientes (con nombre y direccion) y la ruta sugerida.
//  - Cliente: ve solo las localidades de las paradas ya confirmadas, sin datos de otras personas.
import { query } from '../config/db.js'
import { agruparRecorrido, paradasDeViaje, paradasPublicas, rutaSugerida } from '../services/paradas.service.js'

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) >= 1 ? Number(v) : null)

// GET /api/viajes/:id/paradas  (comisionista dueno del viaje)
export async function paradasDelComisionista(req, res, next) {
  try {
    const id = idValido(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const { rows } = await query('SELECT id, origen, destino, estado FROM viajes WHERE id = $1 AND usuario_id = $2', [id, req.usuario.id])
    const viaje = rows[0]
    if (!viaje) return res.status(404).json({ mensaje: 'No se encontró el viaje' })
    const todas = await paradasDeViaje(viaje, {
      estados: ['aceptada', 'pendiente'],
      detalle: true,
      incluirExtremos: true,
      incluirLegadas: true,
    })
    const aceptadas = todas.filter((p) => p.estado === 'aceptada' && p.es_intermedia && p.estado_actividad === 'pendiente')
    // La ruta sugerida se calcula solo con las confirmadas y mientras el viaje siga programado.
    const faltanCoordenadas = aceptadas.some((parada) => parada.lat == null || parada.lon == null)
    const sugerencia = viaje.estado !== 'programado'
      ? { estado: 'sin_paradas' }
      : faltanCoordenadas ? { estado: 'no_disponible' } : await rutaSugerida(viaje, aceptadas)
    const recorrido = agruparRecorrido(viaje, todas, sugerencia)
    res.json({ paradas: todas, sugerencia, recorrido })
  } catch (e) { next(e) }
}

// GET /api/solicitudes/viajes-disponibles/:viajeId/paradas  (cliente)
export async function paradasParaCliente(req, res, next) {
  try {
    const id = idValido(req.params.viajeId)
    if (!id) return res.status(400).json({ mensaje: 'El viaje solicitado no es válido' })
    const { rows } = await query(`SELECT id, origen, destino FROM viajes WHERE id = $1 AND estado = 'programado'`, [id])
    if (!rows[0]) return res.status(404).json({ mensaje: 'El viaje no está disponible' })
    res.json({ paradas: paradasPublicas(await paradasDeViaje(rows[0], { estados: ['aceptada'] })) })
  } catch (e) { next(e) }
}
