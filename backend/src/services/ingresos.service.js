// US35 - Registro automatico del cobro de un servicio (pasajero que llega a destino / encomienda retirada).
// Se llama dentro de la misma transaccion que cambia el estado de la solicitud.
// Devuelve el ingreso creado, o null si no se puede cobrar (monto "a convenir") o ya estaba cobrado.
import { hoyEnCordoba } from './estado-viaje.js'

export async function registrarIngresoDeSolicitud(db, solicitudId) {
  const { rows } = await db.query(
    `SELECT s.id, s.tipo, s.monto, s.forma_pago, s.origen_localidad, s.destino_localidad,
            v.id AS viaje_id, v.usuario_id, v.origen, v.destino
     FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
     WHERE s.id = $1`,
    [solicitudId],
  )
  const s = rows[0]
  if (!s || s.monto == null || Number(s.monto) <= 0) return null

  const servicio = s.tipo === 'pasajero' ? 'Pasaje' : 'Encomienda'
  const concepto = `${servicio} · ${s.origen_localidad ?? s.origen} → ${s.destino_localidad ?? s.destino}`
  const { rows: creado } = await db.query(
    `INSERT INTO ingresos (viaje_id, usuario_id, solicitud_id, tipo_servicio, concepto, monto, fecha, forma_pago)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (solicitud_id) WHERE estado = 'activo' AND solicitud_id IS NOT NULL DO NOTHING
     RETURNING id, monto::text AS monto, fecha::text AS fecha, forma_pago, concepto`,
    [s.viaje_id, s.usuario_id, s.id, s.tipo, concepto, s.monto, hoyEnCordoba(), s.forma_pago],
  )
  return creado[0] ?? null
}
