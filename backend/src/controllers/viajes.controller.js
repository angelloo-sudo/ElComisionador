// Epica 2: Gestion de Viajes.
import { randomUUID } from 'node:crypto'
import { query, pool } from '../config/db.js'
import { generarFechas } from '../validators/viaje.validador.js'

// Superposicion de horarios: cada viaje ocupa el bloque [hora_salida, hora_llegada].
// Los viajes viejos (cargados antes de existir hora_llegada) no tienen ese dato, asi
// que para ellos se asume un bloque de DURACION_POR_DEFECTO_MINUTOS desde la salida.
const DURACION_POR_DEFECTO_MINUTOS = 60

function aMinutos(hora) {
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function rangoViaje(horaSalida, horaLlegada) {
  const inicio = aMinutos(horaSalida)
  const fin = horaLlegada ? aMinutos(horaLlegada) : inicio + DURACION_POR_DEFECTO_MINUTOS
  return { inicio, fin }
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
      `SELECT v.*,
              (SELECT COUNT(*)::int FROM viaje_pasajero vp WHERE vp.viaje_id = v.id) AS ocupados
       FROM viajes v
       WHERE ${condiciones.join(' AND ')}
       ORDER BY v.fecha, v.hora_salida`,
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
    const { origen, destino, fecha, hora_salida, hora_llegada, cupo_total, repeticion } = req.body
    const usuarioId = req.usuario?.id

    // Fechas a crear: una sola si el viaje es unico, o todas las ocurrencias si se repite.
    const fechas = generarFechas(fecha, repeticion)
    const esSerie = fechas.length > 1 || (repeticion?.tipo && repeticion.tipo !== 'unico')

    // Criterio de aceptacion: no se pueden crear dos viajes del mismo comisionista
    // que se superpongan en horario el mismo dia. Se chequean TODAS las fechas antes
    // de insertar nada, para no dejar una serie a medias.
    const { rows: existentes } = await query(
      `SELECT fecha::text AS fecha, hora_salida, hora_llegada FROM viajes
       WHERE usuario_id = $1 AND fecha = ANY($2::date[]) AND estado <> 'cancelado'`,
      [usuarioId, fechas]
    )

    const rangoNuevo = rangoViaje(hora_salida, hora_llegada)
    const fechasConflicto = [...new Set(
      existentes
        .filter((v) => seSuperponen(rangoNuevo, rangoViaje(v.hora_salida, v.hora_llegada)))
        .map((v) => v.fecha.slice(0, 10))
    )].sort()

    if (fechasConflicto.length > 0) {
      const lista = fechasConflicto
        .slice(0, 5)
        .map((f) => f.split('-').reverse().join('/'))
        .join(', ')
      const resto = fechasConflicto.length > 5 ? ` y ${fechasConflicto.length - 5} más` : ''
      return res.status(409).json({
        mensaje: fechas.length === 1
          ? 'Ya tenés un viaje programado que se superpone con ese horario ese mismo día'
          : `Ya tenés viajes que se superponen con ese horario en: ${lista}${resto}. No se creó ninguno.`,
      })
    }

    const serieId = esSerie ? randomUUID() : null
    const repeticionDias = !esSerie
      ? null
      : repeticion.tipo === 'diario'
        ? 'todos'
        : [...new Set(repeticion.dias.map(Number))].sort().join(',')

    // Todo o nada: si falla un insert, no queda ningun viaje de la serie.
    const cliente = await pool.connect()
    try {
      await cliente.query('BEGIN')
      const creados = []
      for (const f of fechas) {
        const { rows } = await cliente.query(
          `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada,
                               cupo_total, serie_id, repeticion_dias)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [usuarioId, origen.trim(), destino.trim(), f, hora_salida, hora_llegada,
           cupo_total ?? 0, serieId, repeticionDias]
        )
        creados.push(rows[0])
      }
      await cliente.query('COMMIT')

      // Compatibilidad: un viaje unico responde con el viaje; una serie, con la lista.
      res.status(201).json(esSerie ? { cantidad: creados.length, viajes: creados } : creados[0])
    } catch (e) {
      await cliente.query('ROLLBACK')
      throw e
    } finally {
      cliente.release()
    }
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
