// Epica 2: Gestion de Viajes.
import { randomUUID } from 'node:crypto'
import { query, pool } from '../config/db.js'
import { generarFechas } from '../validators/viaje.validador.js'
import { rangoViaje, seSuperponen, extenderSeries } from '../services/viajes.service.js'

// US16 - Listar viajes del comisionista logueado, con filtros opcionales por
// query string: ?fecha=YYYY-MM-DD&origen=texto&destino=texto&estado=programado
export async function listar(req, res, next) {
  try {
    const usuarioId = req.usuario?.id
    const { fecha, origen, destino, estado } = req.query

    // Las series repetitivas no tienen fin: antes de listar se completan hasta 3 meses adelante.
    try {
      await extenderSeries({ usuarioId })
    } catch (e) {
      console.error('No se pudieron extender las series de viajes:', e.message)
    }

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

    // Los viajes repetitivos se registran todos, pero en el listado de cada serie se muestra de a
    // uno: el proximo que todavia no se realizo (y cuando pasa su horario aparece el siguiente).
    // Se ven siempre los que estan en curso o finalizados, los cancelados que ya pasaron y el
    // primer cancelado futuro de la serie (para que se vea que se cancelo). Los viajes unicos
    // se muestran todos. La hora de "ahora" se toma en la zona horaria de Cordoba.
    const { rows } = await query(
      `WITH base AS (
         SELECT v.*,
                (SELECT COUNT(*)::int FROM viaje_pasajero vp WHERE vp.viaje_id = v.id AND vp.estado = 'activo') AS ocupados,
                (v.fecha + COALESCE(v.hora_llegada, v.hora_salida, TIME '23:59'))
                  <= (NOW() AT TIME ZONE 'America/Argentina/Cordoba') AS ya_paso
         FROM viajes v
         WHERE ${condiciones.join(' AND ')}
       ), ordenados AS (
         SELECT base.*,
                ROW_NUMBER() OVER (PARTITION BY serie_id, estado, ya_paso ORDER BY fecha, hora_salida) AS orden_serie
         FROM base
       )
       SELECT * FROM ordenados
       WHERE serie_id IS NULL
          OR estado IN ('en_curso', 'finalizado')
          OR (estado = 'programado' AND NOT ya_paso AND orden_serie = 1)
          OR (estado = 'cancelado' AND (ya_paso OR orden_serie = 1))
       ORDER BY fecha, hora_salida`,
      valores
    )

    // Columnas auxiliares de la consulta: no forman parte del viaje.
    res.json(rows.map(({ ya_paso, orden_serie, ...viaje }) => viaje))
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const resultado = await query(
      `SELECT v.*,
              (SELECT COUNT(*)::int
               FROM viaje_pasajero vp
               WHERE vp.viaje_id = v.id AND vp.estado = 'activo') AS ocupados,
              COALESCE((
                SELECT json_agg(p.nombre ORDER BY p.nombre)
                FROM viaje_pasajero vp
                JOIN pasajeros p ON p.id = vp.pasajero_id
                WHERE vp.viaje_id = v.id AND vp.estado = 'activo'
              ), '[]'::json) AS pasajeros
       FROM viajes v WHERE v.id = $1 AND v.usuario_id = $2`,
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

// US16 - Registrar cancelacion de viaje.
// Solo se puede cancelar un viaje en estado "Programado"; al confirmar pasa a "Cancelado" y
// deja de admitir pasajeros y encomiendas (ver services/viajes.service.js).
// Si el viaje es parte de una serie repetitiva, "alcance" indica a cuales aplica:
//   'este'       -> solo el viaje elegido (por defecto); la serie sigue repitiendose
//   'siguientes' -> el elegido y los siguientes de su serie; la serie deja de repetirse
//   'serie'      -> todos los viajes programados de la serie; deja de repetirse
const ALCANCES_CANCELACION = ['este', 'siguientes', 'serie']

export async function cancelar(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const alcance = req.body?.alcance ?? 'este'

    if (!ALCANCES_CANCELACION.includes(alcance)) {
      return res.status(400).json({ mensaje: 'El alcance de la cancelacion no es valido' })
    }

    const { rows } = await query(
      'SELECT id, estado, serie_id FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    const viaje = rows[0]
    if (viaje.estado !== 'programado') {
      return res.status(409).json({ mensaje: 'Solo se pueden cancelar viajes en estado Programado' })
    }

    // Condicion segun el alcance. Siempre se filtra por usuario y por estado "programado":
    // los viajes de la serie que ya se iniciaron o finalizaron no se tocan.
    let condicion = 'id = $1'
    let valores = [id, usuarioId]
    if (viaje.serie_id && alcance !== 'este') {
      condicion = 'serie_id = $1'
      valores = [viaje.serie_id, usuarioId]
      if (alcance === 'siguientes') {
        // Se compara contra el propio viaje elegido en la base, sin pasar fechas por JS.
        valores.push(id)
        condicion += ' AND (fecha, hora_salida) >= (SELECT fecha, hora_salida FROM viajes WHERE id = $3)'
      }
    }

    // Cancelar "este y los siguientes" o "toda la serie" tambien corta la repeticion: se limpia
    // repeticion_dias para que la serie no se vuelva a extender. Todo junto o nada.
    const cliente = await pool.connect()
    let cancelados
    try {
      await cliente.query('BEGIN')
      // Al cancelar una serie ("siguientes" o "toda") solo se cancelan los viajes que todavia no
      // se realizaron; los que ya pasaron de fecha/horario quedan como estan.
      const soloPendientes = viaje.serie_id && alcance !== 'este'
        ? " AND (fecha + COALESCE(hora_llegada, hora_salida, TIME '23:59')) > (NOW() AT TIME ZONE 'America/Argentina/Cordoba')"
        : ''
      const resultado = await cliente.query(
        `UPDATE viajes SET estado = 'cancelado'
         WHERE ${condicion} AND usuario_id = $2 AND estado = 'programado'${soloPendientes}
         RETURNING *`,
        valores
      )
      cancelados = resultado.rows
      if (viaje.serie_id && alcance !== 'este') {
        await cliente.query(
          `UPDATE viajes SET repeticion_dias = NULL WHERE ${condicion} AND usuario_id = $2`,
          valores
        )
        cancelados = cancelados.map((v) => ({ ...v, repeticion_dias: null }))
      }
      await cliente.query('COMMIT')
    } catch (e) {
      await cliente.query('ROLLBACK')
      throw e
    } finally {
      cliente.release()
    }

    res.status(200).json({ cantidad: cancelados.length, viajes: cancelados })
  } catch (e) { next(e) }
}

// US18 - Modificar definicion de viaje.
// Se puede editar recorrido, fecha, horario y cupo de un viaje en estado "Programado". Si el
// viaje es parte de una serie repetitiva, "alcance" indica a cuales aplica el cambio:
//   'este'       -> solo el viaje elegido (por defecto); es el unico caso en que se puede cambiar la fecha
//   'siguientes' -> el elegido y los siguientes de su serie que todavia no se realizaron
// Antes de guardar se valida que no se superponga con otros viajes del comisionista y que el
// cupo no quede por debajo de los pasajeros ya asociados. Todo o nada.
const ALCANCES_EDICION = ['este', 'siguientes']

export async function actualizar(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const { origen, destino, fecha, hora_salida, hora_llegada, cupo_total } = req.body
    const alcance = req.body.alcance ?? 'este'

    if (!ALCANCES_EDICION.includes(alcance)) {
      return res.status(400).json({ mensaje: 'El alcance de la modificacion no es valido' })
    }

    const { rows } = await query(
      'SELECT id, estado, fecha::text AS fecha, serie_id FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }
    const viaje = rows[0]
    if (viaje.estado !== 'programado') {
      return res.status(409).json({ mensaje: 'Solo se pueden modificar viajes en estado Programado' })
    }

    const aplicaASerie = Boolean(viaje.serie_id) && alcance === 'siguientes'
    if (aplicaASerie && fecha !== viaje.fecha) {
      return res.status(400).json({ mensaje: 'La fecha solo se puede cambiar al modificar un unico viaje' })
    }

    // Viajes que se van a modificar (con la cantidad de pasajeros asociados a cada uno).
    const { rows: objetivos } = aplicaASerie
      ? await query(
          `SELECT v.id, v.fecha::text AS fecha,
                  (SELECT COUNT(*)::int FROM viaje_pasajero vp WHERE vp.viaje_id = v.id AND vp.estado = 'activo') AS ocupados
           FROM viajes v
           WHERE v.serie_id = $1 AND v.usuario_id = $2 AND v.estado = 'programado'
             AND (v.fecha, v.hora_salida) >= (SELECT fecha, hora_salida FROM viajes WHERE id = $3)
             AND (v.id = $3 OR (v.fecha + COALESCE(v.hora_llegada, v.hora_salida, TIME '23:59'))
                               > (NOW() AT TIME ZONE 'America/Argentina/Cordoba'))`,
          [viaje.serie_id, usuarioId, id]
        )
      : await query(
          `SELECT v.id, v.fecha::text AS fecha,
                  (SELECT COUNT(*)::int FROM viaje_pasajero vp WHERE vp.viaje_id = v.id AND vp.estado = 'activo') AS ocupados
           FROM viajes v WHERE v.id = $1`,
          [id]
        )
    const ids = objetivos.map((o) => o.id)

    // El cupo no puede quedar por debajo de los pasajeros que ya tiene el viaje.
    const maxOcupados = Math.max(...objetivos.map((o) => o.ocupados))
    if (maxOcupados > Number(cupo_total)) {
      return res.status(409).json({
        mensaje: `El cupo no puede ser menor que los ${maxOcupados} pasajeros que ya tiene asociados el viaje`,
      })
    }

    // No se pueden superponer con otros viajes del comisionista (se ignoran los que se estan
    // modificando y los cancelados). Se chequean todas las fechas antes de guardar nada.
    const fechas = [...new Set(objetivos.map((o) => (aplicaASerie ? o.fecha : fecha)))]
    const { rows: existentes } = await query(
      `SELECT fecha::text AS fecha, hora_salida, hora_llegada FROM viajes
       WHERE usuario_id = $1 AND fecha = ANY($2::date[]) AND estado <> 'cancelado'
         AND id <> ALL($3::int[])`,
      [usuarioId, fechas, ids]
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
        mensaje: objetivos.length === 1
          ? 'Ya tenés un viaje programado que se superpone con ese horario ese mismo día'
          : `Ya tenés viajes que se superponen con ese horario en: ${lista}${resto}. No se modificó ninguno.`,
      })
    }

    const valores = [origen.trim(), destino.trim(), hora_salida, hora_llegada, Number(cupo_total), ids, usuarioId]
    if (!aplicaASerie) valores.push(fecha)
    const { rows: actualizados } = await query(
      `UPDATE viajes
       SET origen = $1, destino = $2, hora_salida = $3, hora_llegada = $4, cupo_total = $5${aplicaASerie ? '' : ', fecha = $8'}
       WHERE id = ANY($6::int[]) AND usuario_id = $7 AND estado = 'programado'
       RETURNING *`,
      valores
    )
    actualizados.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.id - b.id)

    // Pasajeros asociados a los viajes modificados: el frontend muestra la alerta para avisarles.
    const pasajerosAfectados = objetivos.reduce((total, o) => total + o.ocupados, 0)
    res.status(200).json({ cantidad: actualizados.length, viajes: actualizados, pasajerosAfectados })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}
