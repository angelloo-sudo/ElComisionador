// Epica 5: Ingresos, Gastos y Rentabilidad.
import { pool, query } from '../config/db.js'
import { esFechaISOValida } from '../validators/gasto.validador.js'
import { crearDatosSnapshotRentabilidad } from '../services/reportes-rentabilidad.service.js'
export { resumirRentabilidad } from '../services/reportes-rentabilidad.service.js'

export function validarPeriodoRentabilidad(desde, hasta) {
  if (!esFechaISOValida(desde)) return 'La fecha de inicio no es válida'
  if (!esFechaISOValida(hasta)) return 'La fecha de fin no es válida'
  if (desde > hasta) return 'La fecha de inicio no puede ser posterior a la fecha de fin'
  return null
}

export async function registrarIngreso(req, res, next) {
  try { res.status(501).json({ mensaje: 'registrar ingreso: pendiente', body: req.body }) }
  catch (e) { next(e) }
}

export async function gananciaViaje(req, res, next) {
  try { res.status(501).json({ mensaje: `ganancia del viaje ${req.params.viajeId}: pendiente` }) }
  catch (e) { next(e) }
}

export async function rentabilidad(req, res, next) {
  let client
  try {
    const { desde, hasta } = req.query
    const errorPeriodo = validarPeriodoRentabilidad(desde, hasta)
    if (errorPeriodo) return res.status(400).json({ mensaje: errorPeriodo })

    const usuarioId = req.usuario.id
    client = await pool.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    const [perfil, ingresosResult, gastosResult] = await Promise.all([
      client.query('SELECT nombre, apellido FROM usuarios WHERE id = $1', [usuarioId]),
      client.query(
        `SELECT i.id, i.fecha::text AS fecha, i.monto::text AS monto,
                COALESCE(NULLIF(BTRIM(i.concepto), ''),
                  CASE i.tipo_servicio WHEN 'pasajero' THEN 'Traslado de pasajero'
                                       WHEN 'encomienda' THEN 'Encomienda' ELSE 'Ingreso' END) AS concepto,
                CASE WHEN v.id IS NOT NULL THEN v.id END AS viaje_id,
                v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS viaje_fecha
         FROM ingresos i
         LEFT JOIN viajes v ON v.id = i.viaje_id AND v.usuario_id = i.usuario_id
         WHERE i.usuario_id = $1 AND i.estado = 'activo'
           AND i.fecha >= $2::date AND i.fecha <= $3::date
         ORDER BY i.fecha DESC, i.id DESC`,
        [usuarioId, desde, hasta],
      ),
      client.query(
        `SELECT g.id, g.fecha::text AS fecha, g.monto::text AS monto,
                t.nombre AS concepto, g.descripcion,
                CASE WHEN v.id IS NOT NULL THEN v.id END AS viaje_id,
                v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS viaje_fecha
         FROM gastos g
         JOIN tipos_gasto t ON t.id = g.tipo_gasto_id AND t.usuario_id = g.usuario_id
         LEFT JOIN viajes v ON v.id = g.viaje_id AND v.usuario_id = g.usuario_id
         WHERE g.usuario_id = $1 AND g.fecha >= $2::date AND g.fecha <= $3::date
         ORDER BY g.fecha DESC, g.id DESC`,
        [usuarioId, desde, hasta],
      ),
    ])
    const comisionista = `${perfil.rows[0]?.nombre ?? ''} ${perfil.rows[0]?.apellido ?? ''}`.trim()
    const generadoEn = new Date().toISOString()
    const datos = crearDatosSnapshotRentabilidad({
      comisionista,
      desde,
      hasta,
      generadoEn,
      ingresos: ingresosResult.rows,
      gastos: gastosResult.rows,
    })
    const guardado = await client.query(
      `INSERT INTO reportes_rentabilidad
         (usuario_id, periodo_desde, periodo_hasta, generado_en, total_ingresos, total_gastos,
          resultado_economico, version_snapshot, datos_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8::jsonb)
       RETURNING id, generado_en`,
      [usuarioId, desde, hasta, generadoEn, datos.total_ingresos, datos.total_gastos,
        datos.resultado_economico, JSON.stringify(datos)],
    )
    await client.query('COMMIT')
    res.json({ ...datos, id: guardado.rows[0].id, generado_en: guardado.rows[0].generado_en })
  }
  catch (e) {
    if (client) {
      try { await client.query('ROLLBACK') } catch { /* conserva el error original */ }
    }
    if (e.code === '42P01' && e.message?.includes('reportes_rentabilidad')) {
      return res.status(503).json({ mensaje: 'El historial de reportes no está habilitado. Aplicá previamente la definición de reportes_rentabilidad de schema.sql.' })
    }
    next(e)
  } finally { client?.release() }
}
