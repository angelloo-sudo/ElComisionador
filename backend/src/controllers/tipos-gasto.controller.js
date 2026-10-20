// Epica 7: Tipos de gasto (ABMC) - US45 (registrar), US46 (modificar), US47 (consultar) y US48 (eliminar).
// Los tipos son propios de cada comisionista. Un tipo con gastos asociados no se puede eliminar.
import { query } from '../config/db.js'
import { parsearId } from '../validators/gasto.validador.js'

const SQL_TIPO = `
  t.id, t.nombre, t.descripcion, t.creado_en, t.actualizado_en,
  (SELECT COUNT(*)::int FROM gastos g WHERE g.tipo_gasto_id = t.id) AS cantidad_gastos`

async function buscarTipo(id, usuarioId) {
  const { rows } = await query(`SELECT ${SQL_TIPO} FROM tipos_gasto t WHERE t.id = $1 AND t.usuario_id = $2`, [id, usuarioId])
  return rows[0] ?? null
}

const idInvalido = (res) => res.status(400).json({ mensaje: 'El tipo de gasto indicado no es válido' })
const noEncontrado = (res) => res.status(404).json({ mensaje: 'Tipo de gasto no encontrado' })
const nombreRepetido = (res) => res.status(409).json({ mensaje: 'Ya tenés un tipo de gasto con ese nombre' })

// US47 - Consultar tipos de gasto. ?q= filtra por nombre.
export async function listar(req, res, next) {
  try {
    const condiciones = ['t.usuario_id = $1']
    const valores = [req.usuario.id]
    const busqueda = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (busqueda) {
      valores.push(`%${busqueda.replace(/[\\%_]/g, '\\$&')}%`)
      condiciones.push(`t.nombre ILIKE $${valores.length}`)
    }
    const { rows } = await query(
      `SELECT ${SQL_TIPO} FROM tipos_gasto t WHERE ${condiciones.join(' AND ')} ORDER BY lower(t.nombre), t.id`,
      valores,
    )
    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const tipo = await buscarTipo(id, req.usuario.id)
    if (!tipo) return noEncontrado(res)
    res.json(tipo)
  } catch (e) { next(e) }
}

// US45 - Registrar tipo de gasto.
export async function crear(req, res, next) {
  try {
    const { nombre, descripcion } = req.datos
    const { rows } = await query(
      'INSERT INTO tipos_gasto (usuario_id, nombre, descripcion) VALUES ($1, $2, $3) RETURNING id',
      [req.usuario.id, nombre, descripcion],
    )
    res.status(201).json(await buscarTipo(rows[0].id, req.usuario.id))
  } catch (e) {
    if (e.code === '23505') return nombreRepetido(res) // indice unico: tambien ante pedidos simultaneos
    next(e)
  }
}

// US46 - Modificar tipo de gasto.
export async function actualizar(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const { nombre, descripcion } = req.datos
    const { rowCount } = await query(
      'UPDATE tipos_gasto SET nombre = $1, descripcion = $2, actualizado_en = NOW() WHERE id = $3 AND usuario_id = $4',
      [nombre, descripcion, id, req.usuario.id],
    )
    if (rowCount === 0) return noEncontrado(res)
    res.json(await buscarTipo(id, req.usuario.id))
  } catch (e) {
    if (e.code === '23505') return nombreRepetido(res)
    next(e)
  }
}

// US48 - Eliminar tipo de gasto. No se puede si tiene gastos asociados.
export async function eliminar(req, res, next) {
  try {
    const id = parsearId(req.params.id)
    if (id === null) return idInvalido(res)
    const tipo = await buscarTipo(id, req.usuario.id)
    if (!tipo) return noEncontrado(res)

    const conGastos = (n) => res.status(409).json({
      mensaje: `No se puede eliminar: el tipo "${tipo.nombre}" tiene ${n} gasto${n === 1 ? '' : 's'} asociado${n === 1 ? '' : 's'}`,
    })
    if (tipo.cantidad_gastos > 0) return conGastos(tipo.cantidad_gastos)
    try {
      await query('DELETE FROM tipos_gasto WHERE id = $1 AND usuario_id = $2', [id, req.usuario.id])
    } catch (e) {
      if (e.code === '23503') return conGastos(1) // le asignaron un gasto justo ahora
      throw e
    }
    res.status(204).end()
  } catch (e) { next(e) }
}
