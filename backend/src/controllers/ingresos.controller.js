// Epica 6: Administracion de Ingresos.
//  - US35: el cobro se registra solo (ver services/ingresos.service.js).
//  - US37: consultar el detalle de un ingreso.   - US38: modificar un ingreso.
//  - US39: anular un ingreso (baja logica: deja de sumar en totales y reportes).
import { query } from '../config/db.js'
import { esFechaISOValida, parsearId, validarMonto } from '../validators/gasto.validador.js'
import { hoyEnCordoba } from '../services/estado-viaje.js'

const FORMAS_PAGO = ['efectivo', 'transferencia']

const SQL_INGRESO = `
  i.id, i.monto::text AS monto, i.fecha::text AS fecha, i.forma_pago, i.estado, i.concepto, i.tipo_servicio,
  i.motivo_anulacion, i.anulado_en, i.creado_en, i.actualizado_en, i.viaje_id, i.solicitud_id,
  v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS viaje_fecha,
  s.origen_localidad, s.destino_localidad,
  CASE WHEN i.tipo_servicio = 'encomienda' THEN trim(COALESCE(s.emisor_nombre, '') || ' ' || COALESCE(s.emisor_apellido, ''))
       ELSE trim(COALESCE(s.nombre, '') || ' ' || COALESCE(s.apellido, '')) END AS cliente,
  cu.email AS cliente_email`
const SQL_DESDE = `FROM ingresos i
  LEFT JOIN viajes v ON v.id = i.viaje_id
  LEFT JOIN solicitudes_viaje s ON s.id = i.solicitud_id
  LEFT JOIN clientes c ON c.id = s.cliente_id
  LEFT JOIN usuarios cu ON cu.id = c.usuario_id`

function sumar(filas) {
  const centavos = filas.reduce((t, f) => t + BigInt(String(f.monto).replace('.', '')), 0n)
  const txt = centavos.toString().padStart(3, '0')
  return `${txt.slice(0, -2)}.${txt.slice(-2)}`
}

async function buscar(id, usuarioId) {
  const { rows } = await query(`SELECT ${SQL_INGRESO} ${SQL_DESDE} WHERE i.id = $1 AND i.usuario_id = $2`, [id, usuarioId])
  return rows[0] ?? null
}

// GET /api/finanzas/ingresos?desde&hasta&forma_pago&tipo&estado=activo|anulado|todos (por defecto activo)
export async function listar(req, res, next) {
  try {
    const { desde, hasta, forma_pago: forma, tipo, estado = 'activo' } = req.query
    if (desde && !esFechaISOValida(desde)) return res.status(400).json({ mensaje: 'La fecha "desde" tiene un formato inválido' })
    if (hasta && !esFechaISOValida(hasta)) return res.status(400).json({ mensaje: 'La fecha "hasta" tiene un formato inválido' })
    if (desde && hasta && desde > hasta) return res.status(400).json({ mensaje: 'La fecha "desde" no puede ser posterior a "hasta"' })
    if (forma && !FORMAS_PAGO.includes(forma)) return res.status(400).json({ mensaje: 'La forma de pago indicada no es válida' })
    if (tipo && !['pasajero', 'encomienda'].includes(tipo)) return res.status(400).json({ mensaje: 'El tipo de servicio indicado no es válido' })
    if (!['activo', 'anulado', 'todos'].includes(estado)) return res.status(400).json({ mensaje: 'El estado indicado no es válido' })

    const cond = ['i.usuario_id = $1']
    const val = [req.usuario.id]
    if (desde) { val.push(desde); cond.push(`i.fecha >= $${val.length}`) }
    if (hasta) { val.push(hasta); cond.push(`i.fecha <= $${val.length}`) }
    if (forma) { val.push(forma); cond.push(`i.forma_pago = $${val.length}`) }
    if (tipo) { val.push(tipo); cond.push(`i.tipo_servicio = $${val.length}`) }
    if (estado !== 'todos') { val.push(estado); cond.push(`i.estado = $${val.length}`) }

    const { rows } = await query(`SELECT ${SQL_INGRESO} ${SQL_DESDE} WHERE ${cond.join(' AND ')} ORDER BY i.fecha DESC, i.id DESC`, val)
    // El total solo suma los ingresos vigentes: los anulados no cuentan.
    const vigentes = rows.filter((r) => r.estado === 'activo')
    res.json({ ingresos: rows, resumen: { cantidad: vigentes.length, total: sumar(vigentes) } })
  } catch (e) { next(e) }
}

// GET /api/finanzas/ingresos/:id  (US37)
export async function obtener(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El ingreso indicado no es válido' })
    const ingreso = await buscar(id, req.usuario.id)
    if (!ingreso) return res.status(404).json({ mensaje: 'Ingreso no encontrado' })
    res.json(ingreso)
  } catch (e) { next(e) }
}

// PUT /api/finanzas/ingresos/:id  { monto, fecha, forma_pago }  (US38)
export async function modificar(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El ingreso indicado no es válido' })
    const errores = []
    const monto = validarMonto(req.body?.monto)
    if (monto.error) errores.push(monto.error)
    const fecha = req.body?.fecha
    if (!esFechaISOValida(fecha)) errores.push('La fecha no es válida')
    else if (fecha > hoyEnCordoba()) errores.push('La fecha del ingreso no puede ser posterior a hoy')
    else if (fecha < '2000-01-01') errores.push('La fecha del ingreso es demasiado antigua')
    if (!FORMAS_PAGO.includes(req.body?.forma_pago)) errores.push('Elegí la forma de pago: efectivo o transferencia')
    if (errores.length > 0) return res.status(400).json({ errores, mensaje: errores[0] })

    const actual = await buscar(id, req.usuario.id)
    if (!actual) return res.status(404).json({ mensaje: 'Ingreso no encontrado' })
    if (actual.estado === 'anulado') return res.status(409).json({ mensaje: 'Un ingreso anulado no se puede modificar' })

    await query(
      `UPDATE ingresos SET monto = $2, fecha = $3, forma_pago = $4, actualizado_en = NOW() WHERE id = $1`,
      [id, monto.valor, fecha, req.body.forma_pago],
    )
    res.json(await buscar(id, req.usuario.id))
  } catch (e) { next(e) }
}

// PATCH /api/finanzas/ingresos/:id/anular  { motivo? }  (US39)
export async function anular(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (!id) return res.status(400).json({ mensaje: 'El ingreso indicado no es válido' })
    let motivo = null
    if (req.body?.motivo != null) {
      if (typeof req.body.motivo !== 'string') return res.status(400).json({ mensaje: 'El motivo no es válido' })
      motivo = req.body.motivo.trim() || null
      if (motivo && motivo.length > 300) return res.status(400).json({ mensaje: 'El motivo admite hasta 300 caracteres' })
    }
    const { rowCount } = await query(
      `UPDATE ingresos SET estado = 'anulado', motivo_anulacion = $3, anulado_en = NOW(), actualizado_en = NOW()
       WHERE id = $1 AND usuario_id = $2 AND estado = 'activo'`,
      [id, req.usuario.id, motivo],
    )
    if (rowCount === 0) {
      const existente = await buscar(id, req.usuario.id)
      if (!existente) return res.status(404).json({ mensaje: 'Ingreso no encontrado' })
      return res.status(409).json({ mensaje: 'El ingreso ya estaba anulado' })
    }
    res.json(await buscar(id, req.usuario.id))
  } catch (e) { next(e) }
}
