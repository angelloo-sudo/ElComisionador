// Epica 7: Gastos (ABMC) - US40 (registrar), US41 (modificar), US42 (eliminar), US43 (consultar)
// y US44 (asociar a un tipo de gasto). El tipo de gasto es el concepto del gasto.
// Cada gasto pertenece al comisionista que lo registro.
import { query } from '../config/db.js'
import { esFechaISOValida, parsearId } from '../validators/gasto.validador.js'

// fecha se pide como texto para evitar corrimientos de zona horaria.
const SQL_GASTO = `
  g.id, g.monto, g.fecha::text AS fecha, g.descripcion, g.creado_en, g.actualizado_en,
  g.tipo_gasto_id, t.nombre AS tipo_nombre`
const SQL_DESDE = 'FROM gastos g JOIN tipos_gasto t ON t.id = g.tipo_gasto_id'

async function buscarGasto(id, usuarioId) {
  const { rows } = await query(`SELECT ${SQL_GASTO} ${SQL_DESDE} WHERE g.id = $1 AND g.usuario_id = $2`, [id, usuarioId])
  return rows[0] ?? null
}

const tipoPropio = async (tipoId, usuarioId) =>
  (await query('SELECT 1 FROM tipos_gasto WHERE id = $1 AND usuario_id = $2', [tipoId, usuarioId])).rowCount > 0

const idInvalido = (res) => res.status(400).json({ mensaje: 'El gasto indicado no es válido' })
const noEncontrado = (res) => res.status(404).json({ mensaje: 'Gasto no encontrado' })
const tipoNoDisponible = (res) => res.status(400).json({ mensaje: 'El tipo de gasto elegido no existe' })

// Suma exacta de montos NUMERIC(12,2) (llegan como texto "1500.00") usando centavos enteros.
function sumarMontos(filas) {
  const centavos = filas.reduce((suma, fila) => suma + BigInt(String(fila.monto).replace('.', '')), 0n)
  const texto = centavos.toString().padStart(3, '0')
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`
}

// US43 - Consultar gastos. Filtros opcionales: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=<id>&q=texto
// (q busca en el tipo de gasto y en la descripcion). Devuelve { gastos, resumen: { cantidad, total } }.
export async function listar(req, res, next) {
  try {
    const { desde, hasta, tipo, q } = req.query
    if (desde && !esFechaISOValida(desde)) return res.status(400).json({ mensaje: 'La fecha "desde" tiene un formato inválido' })
    if (hasta && !esFechaISOValida(hasta)) return res.status(400).json({ mensaje: 'La fecha "hasta" tiene un formato inválido' })
    if (desde && hasta && desde > hasta) return res.status(400).json({ mensaje: 'La fecha "desde" no puede ser posterior a "hasta"' })

    const condiciones = ['g.usuario_id = $1']
    const valores = [req.usuario.id]
    if (desde) { valores.push(desde); condiciones.push(`g.fecha >= $${valores.length}`) }
    if (hasta) { valores.push(hasta); condiciones.push(`g.fecha <= $${valores.length}`) }
    if (tipo) {
      const tipoId = parsearId(tipo)
      if (tipoId === null) return res.status(400).json({ mensaje: 'El tipo de gasto indicado no es válido' })
      valores.push(tipoId)
      condiciones.push(`g.tipo_gasto_id = $${valores.length}`)
    }
    const busqueda = typeof q === 'string' ? q.trim() : ''
    if (busqueda) {
      valores.push(`%${busqueda.replace(/[\\%_]/g, '\\$&')}%`)
      condiciones.push(`(t.nombre ILIKE $${valores.length} OR g.descripcion ILIKE $${valores.length})`)
    }

    const { rows } = await query(
      `SELECT ${SQL_GASTO} ${SQL_DESDE} WHERE ${condiciones.join(' AND ')} ORDER BY g.fecha DESC, g.id DESC`,
      valores,
    )
    res.json({ gastos: rows, resumen: { cantidad: rows.length, total: sumarMontos(rows) } })
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const gasto = await buscarGasto(id, req.usuario.id)
    if (!gasto) return noEncontrado(res)
    res.json(gasto)
  } catch (e) { next(e) }
}

// US40 - Registrar gasto.
export async function crear(req, res, next) {
  try {
    const { tipo_gasto_id: tipoId, monto, fecha, descripcion } = req.datos
    const usuarioId = req.usuario.id
    if (!(await tipoPropio(tipoId, usuarioId))) return tipoNoDisponible(res)

    const { rows } = await query(
      'INSERT INTO gastos (usuario_id, tipo_gasto_id, monto, fecha, descripcion) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [usuarioId, tipoId, monto, fecha, descripcion],
    )
    res.status(201).json(await buscarGasto(rows[0].id, usuarioId))
  } catch (e) { next(e) }
}

// US41 - Modificar gasto.
export async function actualizar(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const usuarioId = req.usuario.id
    const { tipo_gasto_id: tipoId, monto, fecha, descripcion } = req.datos

    if (!(await buscarGasto(id, usuarioId))) return noEncontrado(res)
    if (!(await tipoPropio(tipoId, usuarioId))) return tipoNoDisponible(res)

    await query(
      `UPDATE gastos SET tipo_gasto_id = $1, monto = $2, fecha = $3, descripcion = $4, actualizado_en = NOW()
       WHERE id = $5 AND usuario_id = $6`,
      [tipoId, monto, fecha, descripcion, id, usuarioId],
    )
    res.json(await buscarGasto(id, usuarioId))
  } catch (e) { next(e) }
}

// US44 - Asociar un gasto a otro tipo de gasto.
export async function asignarTipo(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const usuarioId = req.usuario.id
    const tipoId = parsearId(req.body?.tipo_gasto_id)
    if (tipoId === null) return res.status(400).json({ mensaje: 'Indicá un tipo de gasto válido' })

    if (!(await buscarGasto(id, usuarioId))) return noEncontrado(res)
    if (!(await tipoPropio(tipoId, usuarioId))) return tipoNoDisponible(res)

    await query('UPDATE gastos SET tipo_gasto_id = $1, actualizado_en = NOW() WHERE id = $2 AND usuario_id = $3', [tipoId, id, usuarioId])
    res.json(await buscarGasto(id, usuarioId))
  } catch (e) { next(e) }
}

// US42 - Eliminar gasto.
export async function eliminar(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const { rowCount } = await query('DELETE FROM gastos WHERE id = $1 AND usuario_id = $2', [id, req.usuario.id])
    if (rowCount === 0) return noEncontrado(res)
    res.status(204).end()
  } catch (e) { next(e) }
}
