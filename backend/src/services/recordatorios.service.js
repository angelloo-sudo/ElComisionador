import { query } from '../config/db.js'
import { enviarEmailRecordatorioViaje } from './email.service.js'

// Marca cada aviso como procesando antes de enviar para evitar envíos concurrentes entre instancias.
// Si el proceso cae durante el envío, otra pasada puede recuperar el aviso después de 10 minutos.
export async function procesarRecordatorios() {
  const { rows } = await query(
    `UPDATE recordatorios_viaje r
     SET estado = 'procesando', procesamiento_iniciado_en = NOW(), actualizado_en = NOW()
     FROM viajes v, usuarios u
     WHERE r.viaje_id = v.id AND u.id = v.usuario_id
       AND v.estado = 'programado' AND u.activo = true
       AND r.programado_para <= NOW()
       AND (r.estado = 'pendiente' OR (r.estado = 'procesando' AND r.procesamiento_iniciado_en < NOW() - INTERVAL '10 minutes'))
     RETURNING r.id, r.viaje_id, r.minutos_anticipacion, v.origen, v.destino,
               v.fecha::text AS fecha, v.hora_salida, u.email`,
  )

  for (const recordatorio of rows) {
    try {
      await enviarEmailRecordatorioViaje({
        email: recordatorio.email,
        origen: recordatorio.origen,
        destino: recordatorio.destino,
        fecha: recordatorio.fecha,
        hora: String(recordatorio.hora_salida).slice(0, 5),
        minutosAnticipacion: recordatorio.minutos_anticipacion,
      })
      await query(
        `UPDATE recordatorios_viaje SET estado = 'enviado', enviado_en = NOW(), actualizado_en = NOW()
         WHERE id = $1 AND estado = 'procesando'`,
        [recordatorio.id],
      )
    } catch (e) {
      await query(
        `UPDATE recordatorios_viaje SET estado = 'pendiente', procesamiento_iniciado_en = NULL, actualizado_en = NOW()
         WHERE id = $1 AND estado = 'procesando'`,
        [recordatorio.id],
      )
      console.error(`No se pudo enviar el recordatorio del viaje ${recordatorio.viaje_id}:`, e.message)
    }
  }
  return rows.length
}
