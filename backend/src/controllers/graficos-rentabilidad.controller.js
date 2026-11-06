import { query } from '../config/db.js'
import { esFechaISOValida } from '../validators/gasto.validador.js'
import { clasificarRentabilidad } from '../services/reportes-rentabilidad.service.js'

const AGRUPACIONES = new Set(['dia', 'semana', 'mes'])
const UNIDADES_POSTGRES = { dia: 'day', semana: 'week', mes: 'month' }

export function validarFiltrosGraficos({ desde, hasta, agrupacion }) {
  if (!esFechaISOValida(desde)) return { error: 'La fecha de inicio no es válida' }
  if (!esFechaISOValida(hasta)) return { error: 'La fecha de fin no es válida' }
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin' }
  if (agrupacion !== undefined && !AGRUPACIONES.has(agrupacion)) {
    return { error: 'La agrupación debe ser dia, semana o mes' }
  }
  return { agrupacion: agrupacion ?? 'mes' }
}

function agregarResultado(fila) {
  const resumen = clasificarRentabilidad(fila.total_ingresos, fila.total_gastos)
  return {
    ...fila,
    ...resumen,
    resultado_economico: resumen.resultado_economico,
  }
}

export async function porPeriodo(req, res, next) {
  try {
    const filtros = validarFiltrosGraficos(req.query)
    if (filtros.error) return res.status(400).json({ mensaje: filtros.error })

    const { rows } = await query(
      `WITH movimientos AS (
         SELECT date_trunc($4::text, i.fecha::timestamp)::date AS periodo,
                i.monto, 'ingreso'::text AS tipo
         FROM ingresos i
         WHERE i.usuario_id = $1 AND i.estado = 'activo'
           AND i.fecha >= $2::date AND i.fecha <= $3::date
         UNION ALL
         SELECT date_trunc($4::text, g.fecha::timestamp)::date AS periodo,
                g.monto, 'gasto'::text AS tipo
         FROM gastos g
         JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id AND tg.usuario_id = g.usuario_id
         WHERE g.usuario_id = $1 AND g.fecha >= $2::date AND g.fecha <= $3::date
       ), agregados AS (
         SELECT periodo,
                COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0)::text AS total_ingresos,
                COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0)::text AS total_gastos
         FROM movimientos
         GROUP BY periodo
       )
       SELECT periodo::text,
              GREATEST(periodo, $2::date)::text AS periodo_desde,
              LEAST(
                (periodo + CASE $4::text WHEN 'day' THEN interval '1 day'
                                         WHEN 'week' THEN interval '1 week'
                                         ELSE interval '1 month' END - interval '1 day')::date,
                $3::date
              )::text AS periodo_hasta,
              total_ingresos, total_gastos
       FROM agregados ORDER BY periodo`,
      [req.usuario.id, req.query.desde, req.query.hasta, UNIDADES_POSTGRES[filtros.agrupacion]],
    )

    res.json({ agrupacion: filtros.agrupacion, periodos: rows.map(agregarResultado) })
  } catch (error) {
    next(error)
  }
}

export async function porViaje(req, res, next) {
  try {
    const filtros = validarFiltrosGraficos(req.query)
    if (filtros.error) return res.status(400).json({ mensaje: filtros.error })

    const [viajesResult, generalesResult] = await Promise.all([query(
      `WITH viajes_del_periodo AS (
         SELECT v.id, v.origen, v.destino, v.fecha
         FROM viajes v
         WHERE v.usuario_id = $1 AND v.estado = 'finalizado'
           AND v.fecha >= $2::date AND v.fecha <= $3::date
       ), ingresos_por_viaje AS (
         SELECT i.viaje_id, SUM(i.monto)::numeric(14,2) AS total
         FROM ingresos i
         JOIN viajes_del_periodo v ON v.id = i.viaje_id
         WHERE i.usuario_id = $1 AND i.estado = 'activo'
           AND i.fecha >= $2::date AND i.fecha <= $3::date
         GROUP BY i.viaje_id
       ), gastos_por_viaje AS (
         SELECT g.viaje_id, SUM(g.monto)::numeric(14,2) AS total
         FROM gastos g
         JOIN viajes_del_periodo v ON v.id = g.viaje_id
         JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id AND tg.usuario_id = g.usuario_id
         WHERE g.usuario_id = $1 AND g.fecha >= $2::date AND g.fecha <= $3::date
         GROUP BY g.viaje_id
       )
       SELECT v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha,
              COALESCE(i.total, 0)::text AS total_ingresos,
              COALESCE(g.total, 0)::text AS total_gastos
       FROM viajes_del_periodo v
       LEFT JOIN ingresos_por_viaje i ON i.viaje_id = v.id
       LEFT JOIN gastos_por_viaje g ON g.viaje_id = v.id
       ORDER BY v.fecha, v.id`,
      [req.usuario.id, req.query.desde, req.query.hasta],
    ), query(
      `SELECT
         COALESCE((SELECT SUM(i.monto) FROM ingresos i
                   WHERE i.usuario_id = $1 AND i.estado = 'activo' AND i.viaje_id IS NULL
                     AND i.fecha >= $2::date AND i.fecha <= $3::date), 0)::text AS total_ingresos,
         COALESCE((SELECT SUM(g.monto) FROM gastos g
                   JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id AND tg.usuario_id = g.usuario_id
                   WHERE g.usuario_id = $1 AND g.viaje_id IS NULL
                     AND g.fecha >= $2::date AND g.fecha <= $3::date), 0)::text AS total_gastos`,
      [req.usuario.id, req.query.desde, req.query.hasta],
    )])

    res.json({ viajes: viajesResult.rows.map(agregarResultado), movimientos_generales: agregarResultado(generalesResult.rows[0]) })
  } catch (error) {
    next(error)
  }
}
