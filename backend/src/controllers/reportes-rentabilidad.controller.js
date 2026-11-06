import { query } from '../config/db.js'
import { esFechaISOValida, parsearId } from '../validators/gasto.validador.js'

const noEncontrado = (res) => res.status(404).json({ mensaje: 'Reporte de rentabilidad no encontrado' })

export function validarFiltrosPeriodoReporte(fechaInicio, fechaFin) {
  const inicio = fechaInicio || null
  const fin = fechaFin || null
  if ((inicio === null) !== (fin === null)) {
    return { error: 'Completá ambas fechas del período o limpiá los filtros.' }
  }
  if (inicio === null) return { fechaInicio: null, fechaFin: null }
  if (!esFechaISOValida(inicio)) return { error: 'La fecha de inicio no es válida.' }
  if (!esFechaISOValida(fin)) return { error: 'La fecha de fin no es válida.' }
  if (inicio > fin) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' }
  return { fechaInicio: inicio, fechaFin: fin }
}

export async function listar(req, res, next) {
  try {
    const filtros = validarFiltrosPeriodoReporte(req.query.fechaInicio, req.query.fechaFin)
    if (filtros.error) return res.status(400).json({ mensaje: filtros.error })

    const limiteTexto = req.query.limite ?? '20'
    const offsetTexto = req.query.offset ?? '0'
    if (!/^\d+$/.test(String(limiteTexto)) || !/^\d+$/.test(String(offsetTexto))) {
      return res.status(400).json({ mensaje: 'La paginación indicada no es válida' })
    }
    const limite = Number(limiteTexto)
    const offset = Number(offsetTexto)
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100 || !Number.isSafeInteger(offset)) {
      return res.status(400).json({ mensaje: 'La paginación indicada está fuera de rango' })
    }
    const condiciones = ['usuario_id = $1']
    const parametros = [req.usuario.id]
    if (filtros.fechaInicio !== null) {
      parametros.push(filtros.fechaInicio, filtros.fechaFin)
      condiciones.push(`periodo_desde >= $${parametros.length - 1}::date`)
      condiciones.push(`periodo_hasta <= $${parametros.length}::date`)
    }
    const where = condiciones.join(' AND ')
    const [lista, cuenta] = await Promise.all([
      query(
        `SELECT id, periodo_desde::text AS periodo_desde, periodo_hasta::text AS periodo_hasta,
                generado_en, total_ingresos::text AS total_ingresos,
                total_gastos::text AS total_gastos, resultado_economico::text AS resultado_economico,
                COALESCE((datos_snapshot->>'demo')::boolean, false) AS demo,
                jsonb_array_length(datos_snapshot->'ingresos') AS cantidad_ingresos,
                jsonb_array_length(datos_snapshot->'gastos') AS cantidad_gastos
         FROM reportes_rentabilidad WHERE ${where}
         ORDER BY generado_en DESC, id DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, limite, offset],
      ),
      query(`SELECT COUNT(*)::int AS total FROM reportes_rentabilidad WHERE ${where}`, parametros),
    ])
    res.json({
      reportes: lista.rows,
      paginacion: { limite, offset, total: cuenta.rows[0].total },
      filtros: { fechaInicio: filtros.fechaInicio, fechaFin: filtros.fechaFin },
    })
  } catch (e) {
    if (e.code === '42P01' && e.message?.includes('reportes_rentabilidad')) {
      return res.status(503).json({ mensaje: 'El historial de reportes no está habilitado. Aplicá previamente la definición de reportes_rentabilidad de schema.sql.' })
    }
    next(e)
  }
}

export async function obtener(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El identificador del reporte no es válido' })
    const { rows } = await query(
      `SELECT id, periodo_desde::text AS periodo_desde, periodo_hasta::text AS periodo_hasta,
              generado_en, total_ingresos::text AS total_ingresos,
              total_gastos::text AS total_gastos, resultado_economico::text AS resultado_economico,
              version_snapshot, datos_snapshot
       FROM reportes_rentabilidad WHERE id = $1 AND usuario_id = $2`,
      [id, req.usuario.id],
    )
    const reporte = rows[0]
    if (!reporte) return noEncontrado(res)
    const snapshot = reporte.datos_snapshot
    res.json({
      ...snapshot,
      id: reporte.id,
      version_snapshot: reporte.version_snapshot,
      periodo: { desde: reporte.periodo_desde, hasta: reporte.periodo_hasta },
      generado_en: reporte.generado_en,
      total_ingresos: reporte.total_ingresos,
      total_gastos: reporte.total_gastos,
      resultado_economico: reporte.resultado_economico,
    })
  } catch (e) {
    if (e.code === '42P01' && e.message?.includes('reportes_rentabilidad')) {
      return res.status(503).json({ mensaje: 'El historial de reportes no está habilitado. Aplicá previamente la definición de reportes_rentabilidad de schema.sql.' })
    }
    next(e)
  }
}
