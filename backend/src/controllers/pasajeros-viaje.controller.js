// US22 (registrar subida), US24 (actualizar estado) y US25 (registrar llegada a destino) del pasajero.
// El comisionista ve los pasajeros aceptados de un viaje y les va marcando su avance:
//   pendiente -> A bordo -> En destino      (o Ausente / Cancelado por el comisionista)
// Solo con el viaje en curso: antes de iniciarlo no se puede marcar a nadie.
import { pool } from '../config/db.js'
import { registrarIngresoDeSolicitud } from '../services/ingresos.service.js'
import { ESTADOS_PASAJERO, TRANSICIONES_PASAJERO } from '../services/pasajero-estado.js'

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

// GET /api/viajes/:id/pasajeros
export async function listarPasajeros(req, res, next) {
  try {
    const id = idValido(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const { rows: viajes } = await pool.query('SELECT id, estado FROM viajes WHERE id = $1 AND usuario_id = $2', [id, req.usuario.id])
    if (!viajes[0]) return res.status(404).json({ mensaje: 'No se encontró el viaje' })
    const { rows } = await pool.query(
      `SELECT s.id, s.nombre, s.apellido, s.telefono, s.cantidad_pasajeros, s.estado_pasajero, s.subio_en, s.llego_en,
              s.origen_localidad, s.destino_localidad, s.monto::text AS monto,
              EXISTS (SELECT 1 FROM ingresos i WHERE i.solicitud_id = s.id AND i.estado = 'activo') AS cobrado
       FROM solicitudes_viaje s
       WHERE s.viaje_id = $1 AND s.tipo = 'pasajero' AND s.estado = 'aceptada'
       ORDER BY s.id`,
      [id],
    )
    res.json({ estado_viaje: viajes[0].estado, pasajeros: rows })
  } catch (e) { next(e) }
}

// PATCH /api/solicitudes/:id/pasajero   { estado: 'a_bordo' | 'en_destino' | 'ausente' | 'cancelado_comisionista' | 'pendiente' }
export async function actualizarEstadoPasajero(req, res, next) {
  const id = idValido(req.params.id)
  if (!id) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
  const nuevo = req.body?.estado
  if (typeof nuevo !== 'string' || ![...ESTADOS_PASAJERO, 'pendiente'].includes(nuevo)) {
    return res.status(400).json({ mensaje: 'El estado indicado no es válido' })
  }

  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const { rows } = await db.query(
      `SELECT s.tipo, s.estado, s.estado_pasajero, v.estado AS estado_viaje
       FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
       WHERE s.id = $1 AND v.usuario_id = $2 FOR UPDATE OF s`,
      [id, req.usuario.id],
    )
    const s = rows[0]
    const parar = async (status, mensaje) => { await db.query('ROLLBACK'); return res.status(status).json({ mensaje }) }
    if (!s) return parar(404, 'No se encontró la solicitud')
    if (s.tipo !== 'pasajero' || s.estado !== 'aceptada') return parar(409, 'Solo se puede actualizar el estado de un pasajero con reserva aceptada')
    // Los pasajeros solo se pueden gestionar con el viaje en curso (despues de iniciarlo).
    if (s.estado_viaje === 'programado') return parar(409, 'Primero tenés que iniciar el viaje para registrar a los pasajeros')
    if (s.estado_viaje !== 'en_curso') return parar(409, 'El viaje ya no admite cambios en los pasajeros')

    const actual = s.estado_pasajero ?? 'pendiente'
    if (actual === nuevo) return parar(409, 'El pasajero ya tiene ese estado')
    if (!TRANSICIONES_PASAJERO[actual].includes(nuevo)) return parar(409, 'Ese cambio de estado no está permitido para el pasajero')

    const { rows: r } = await db.query(
      `UPDATE solicitudes_viaje
       SET estado_pasajero = $2::varchar,
           subio_en = CASE WHEN $3::text = 'a_bordo' THEN NOW() WHEN $3::text = 'pendiente' THEN NULL ELSE subio_en END,
           llego_en = CASE WHEN $3::text = 'en_destino' THEN NOW() ELSE llego_en END
       WHERE id = $1 RETURNING estado_pasajero, subio_en, llego_en`,
      [id, nuevo === 'pendiente' ? null : nuevo, nuevo],
    )
    // US35: al llegar a destino se registra el cobro del pasaje.
    const ingreso = nuevo === 'en_destino' ? await registrarIngresoDeSolicitud(db, id) : null
    await db.query('COMMIT')
    res.json({ id, ...r[0], ingreso })
  } catch (e) {
    try { await db.query('ROLLBACK') } catch { /* sin transaccion abierta */ }
    next(e)
  } finally { db.release() }
}
