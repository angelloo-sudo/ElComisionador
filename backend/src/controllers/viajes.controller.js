// Epica 2: Gestion de Viajes.
import { query } from '../config/db.js'

// NOTA sobre superposicion de horarios: la tabla "viajes" solo guarda hora_salida,
// no tiene hora de llegada ni duracion. Para poder detectar una superposicion real
// asumimos que cada viaje "ocupa" un bloque fijo de tiempo a partir de su salida.
// Si el equipo agrega mas adelante un campo de duracion real (o "hora_llegada"),
// esta funcion es el unico lugar que hay que ajustar.
const DURACION_VIAJE_MINUTOS = 60

function rangoMinutos(horaSalida, duracionMinutos = DURACION_VIAJE_MINUTOS) {
  const [horas, minutos] = horaSalida.split(':').map(Number)
  const inicio = horas * 60 + minutos
  return { inicio, fin: inicio + duracionMinutos }
}

function seSuperponen(rangoA, rangoB) {
  return rangoA.inicio < rangoB.fin && rangoB.inicio < rangoA.fin
}

// US16 - Listar viajes del comisionista logueado, con filtros opcionales por
// query string: ?fecha=YYYY-MM-DD&origen=texto&destino=texto&estado=programado
export async function listar(req, res, next) {
  try {
    const usuarioId = req.usuario?.id
    const { fecha, origen, destino, estado } = req.query

    const condiciones = ['usuario_id = $1']
    const valores = [usuarioId]

    if (fecha) {
      valores.push(fecha)
      condiciones.push(`fecha = $${valores.length}`)
    }
    if (origen) {
      valores.push(`%${origen}%`)
      condiciones.push(`origen ILIKE $${valores.length}`)
    }
    if (destino) {
      valores.push(`%${destino}%`)
      condiciones.push(`destino ILIKE $${valores.length}`)
    }
    if (estado) {
      valores.push(estado)
      condiciones.push(`estado = $${valores.length}`)
    }

    const { rows } = await query(
      `SELECT * FROM viajes
       WHERE ${condiciones.join(' AND ')}
       ORDER BY fecha, hora_salida`,
      valores
    )

    res.json(rows)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const resultado = await query(
      'SELECT * FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    res.status(200).json(resultado.rows[0])
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { origen, destino, fecha, hora_salida, cupo_total } = req.body
    const usuarioId = req.usuario?.id

    // Criterio de aceptacion: no se pueden crear dos viajes del mismo comisionista
    // que se superpongan en horario el mismo dia (ver nota de DURACION_VIAJE_MINUTOS).
    const { rows: viajesDelDia } = await query(
      `SELECT hora_salida FROM viajes
       WHERE usuario_id = $1 AND fecha = $2 AND estado <> 'cancelado'`,
      [usuarioId, fecha]
    )

    const rangoNuevo = rangoMinutos(hora_salida)
    const hayConflicto = viajesDelDia.some((v) =>
      seSuperponen(rangoNuevo, rangoMinutos(v.hora_salida.slice(0, 5)))
    )

    if (hayConflicto) {
      return res.status(409).json({
        mensaje: 'Ya tenés un viaje programado que se superpone con ese horario ese mismo día',
      })
    }

    const { rows } = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, cupo_total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [usuarioId, origen, destino, fecha, hora_salida || null, cupo_total ?? 0]
    )

    res.status(201).json(rows[0])
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `actualizar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}
