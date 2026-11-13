// Epica 2: Gestion de Viajes.
import { randomUUID } from 'node:crypto'
import { query, pool } from '../config/db.js'
import { generarFechas } from '../validators/viaje.validador.js'
import { rangoViaje, seSuperponen, extenderSeries, SQL_OCUPADOS } from '../services/viajes.service.js'
import { hoyEnCordoba, obtenerEstadoViaje } from '../services/estado-viaje.js'
import { datosDeViaje, sumarMinutos } from '../services/tarifa.service.js'
import { validarAnticipacionRecordatorio } from '../validators/recordatorio.validador.js'
import { calcularRuta, centroLocalidad } from '../services/geo.service.js'
import { ubicarEnRuta } from '../services/tramo.service.js'
import { calcularHorarioRecorrido } from '../services/horario-recorrido.service.js'

const SQL_PARADAS = `COALESCE((SELECT json_agg(json_build_object('id', p.id, 'orden', p.orden, 'localidad', p.localidad, 'hora_estimada', to_char(p.hora_estimada, 'HH24:MI')) ORDER BY p.orden)
  FROM paradas_viaje p WHERE p.viaje_id = v.id), '[]'::json) AS paradas`

function desplazarFecha(fecha, dias) {
  const fechaUTC = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`)
  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + dias)
  return fechaUTC.toISOString().slice(0, 10)
}

export async function obtenerRecordatorio(req, res, next) {
  try {
    const viajeId = Number(req.params.id)
    if (!Number.isSafeInteger(viajeId) || viajeId < 1) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const { rows: viajeRows } = await query(
      `SELECT id, estado, fecha::text AS fecha, hora_salida,
              ((fecha + hora_salida) AT TIME ZONE 'America/Argentina/Buenos_Aires') AS inicio
       FROM viajes WHERE id = $1 AND usuario_id = $2`,
      [viajeId, req.usuario.id],
    )
    const viaje = viajeRows[0]
    if (!viaje) return res.status(404).json({ mensaje: 'Viaje no encontrado' })
    const { rows } = await query(
      `SELECT minutos_anticipacion, programado_para, estado, enviado_en
       FROM recordatorios_viaje WHERE viaje_id = $1 AND estado <> 'cancelado'`,
      [viaje.id],
    )
    res.json({ recordatorio: rows[0] ?? null })
  } catch (e) { next(e) }
}

export async function eliminarRecordatorio(req, res, next) {
  try {
    const viajeId = Number(req.params.id)
    if (!Number.isSafeInteger(viajeId) || viajeId < 1) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const { rows: viajes } = await query(
      'SELECT id FROM viajes WHERE id = $1 AND usuario_id = $2',
      [viajeId, req.usuario.id],
    )
    if (!viajes[0]) return res.status(404).json({ mensaje: 'Viaje no encontrado' })

    await query(
      `UPDATE recordatorios_viaje SET estado = 'cancelado', procesamiento_iniciado_en = NULL, actualizado_en = NOW()
       WHERE viaje_id = $1 AND estado <> 'cancelado'`,
      [viajeId],
    )
    res.json({ recordatorio: null, mensaje: 'Recordatorio desactivado' })
  } catch (e) { next(e) }
}

export async function guardarRecordatorio(req, res, next) {
  try {
    const viajeId = Number(req.params.id)
    if (!Number.isSafeInteger(viajeId) || viajeId < 1) return res.status(400).json({ mensaje: 'El viaje indicado no es válido' })
    const minutos = req.body?.minutos_anticipacion
    const errorAnticipacion = validarAnticipacionRecordatorio(minutos)
    if (errorAnticipacion) return res.status(400).json({ mensaje: errorAnticipacion })

    const { rows } = await query(
      `SELECT id, estado, fecha::text AS fecha, hora_salida,
              ((fecha + hora_salida) AT TIME ZONE 'America/Argentina/Buenos_Aires') AS inicio
       FROM viajes WHERE id = $1 AND usuario_id = $2`,
      [viajeId, req.usuario.id],
    )
    const viaje = rows[0]
    if (!viaje) return res.status(404).json({ mensaje: 'Viaje no encontrado' })
    if (viaje.estado !== 'programado' || !viaje.hora_salida) {
      return res.status(409).json({ mensaje: 'Solo se puede configurar un recordatorio para un viaje programado con horario de salida' })
    }

    const segundosRestantes = (new Date(viaje.inicio).getTime() - Date.now()) / 1000
    const errorTiempo = validarAnticipacionRecordatorio(minutos, segundosRestantes)
    if (errorTiempo) return res.status(400).json({ mensaje: errorTiempo })

    const { rows: guardados } = await query(
      `INSERT INTO recordatorios_viaje (viaje_id, minutos_anticipacion, programado_para, estado, procesamiento_iniciado_en, enviado_en, actualizado_en)
       VALUES ($1, $2, $3::timestamptz - make_interval(mins => $2), 'pendiente', NULL, NULL, NOW())
       ON CONFLICT (viaje_id) DO UPDATE
         SET minutos_anticipacion = EXCLUDED.minutos_anticipacion,
             programado_para = EXCLUDED.programado_para,
             estado = 'pendiente', procesamiento_iniciado_en = NULL, enviado_en = NULL,
             actualizado_en = NOW()
       RETURNING minutos_anticipacion, programado_para, estado, enviado_en`,
      [viaje.id, minutos, viaje.inicio],
    )
    res.status(200).json({ recordatorio: guardados[0], mensaje: 'Recordatorio configurado correctamente' })
  } catch (e) { next(e) }
}

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
    // Los viajes repetitivos se registran todos, pero se muestran como maximo la ultima ocurrencia
    // vencida y la proxima programada. Tambien se ven siempre los que estan en curso o finalizados,
    // los cancelados que ya pasaron y el primer cancelado futuro de la serie. Los viajes unicos se
    // muestran todos. La fecha actual se toma en la zona horaria de Cordoba; un viaje de hoy sigue
    // programado hasta que termine el dia, independientemente de su hora de llegada.
    const { rows } = await query(
      `WITH base AS (
         SELECT v.*,
                v.fecha::text AS fecha_iso,
                ${SQL_OCUPADOS} AS ocupados,
                ${SQL_PARADAS},
                (SELECT COUNT(*)::int FROM solicitudes_viaje s
                 WHERE s.viaje_id = v.id AND s.tipo = 'encomienda' AND s.estado = 'aceptada') AS encomiendas,
                (v.fecha < $${valores.length + 1}::date) AS ya_paso
         FROM viajes v
         WHERE ${condiciones.join(' AND ')}
       ), ordenados AS (
         SELECT base.*,
                ROW_NUMBER() OVER (PARTITION BY serie_id, estado, ya_paso ORDER BY fecha, hora_salida) AS orden_serie,
                ROW_NUMBER() OVER (PARTITION BY serie_id, estado, ya_paso ORDER BY fecha DESC, hora_salida DESC) AS orden_serie_desc
         FROM base
       )
       SELECT * FROM ordenados
       WHERE serie_id IS NULL
          OR estado IN ('en_curso', 'finalizado')
          OR (estado = 'programado' AND NOT ya_paso AND orden_serie = 1)
          OR (estado = 'programado' AND ya_paso AND orden_serie_desc = 1)
          OR (estado = 'cancelado' AND (ya_paso OR orden_serie = 1))
       ORDER BY fecha, hora_salida`,
      [...valores, hoyEnCordoba()]
    )

    // Columnas auxiliares de la consulta: no forman parte del viaje.
    const viajes = rows.map(({ ya_paso, orden_serie, orden_serie_desc, fecha_iso, ...viaje }) => ({
      ...viaje,
      fecha: fecha_iso,
      estado: obtenerEstadoViaje(viaje.estado, fecha_iso),
    }))
    res.json(estado ? viajes.filter((viaje) => viaje.estado === estado) : viajes)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const resultado = await query(
      `SELECT v.*,
              v.fecha::text AS fecha_iso,
              ${SQL_OCUPADOS} AS ocupados,
              ${SQL_PARADAS},
              (SELECT cm.precio_km FROM comisionistas cm WHERE cm.usuario_id = v.usuario_id) AS precio_km,
              COALESCE((
                SELECT json_agg(s.nombre || ' ' || s.apellido || CASE WHEN s.cantidad_pasajeros > 1 THEN ' (' || s.cantidad_pasajeros || ' pasajeros)' ELSE '' END ORDER BY s.id)
                FROM solicitudes_viaje s
                WHERE s.viaje_id = v.id AND s.tipo = 'pasajero' AND s.estado = 'aceptada'
              ), '[]'::json) AS pasajeros
       FROM viajes v WHERE v.id = $1 AND v.usuario_id = $2`,
      [id, usuarioId]
    )

    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    const { fecha_iso, ...viaje } = resultado.rows[0]
    res.status(200).json({
      ...viaje,
      fecha: fecha_iso,
      estado: obtenerEstadoViaje(viaje.estado, fecha_iso),
    })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { origen, destino, fecha, hora_salida, hora_llegada: llegadaIngresada, duracion_min: duracionIngresada, cupo_total, repeticion } = req.body
    const paradas = req.body.paradas ?? []
    const usuarioId = req.usuario?.id

    // La ruta aporta distancia y una estimación automática. El comisionista puede
    // reemplazar esa estimación ingresando hora de llegada o duración.
    const ruta = await datosDeViaje(origen.trim(), destino.trim(), hora_salida)
    let { distancia_km } = ruta
    let duracion_min = ruta.duracion_min
    let hora_llegada = ruta.hora_llegada
    if (llegadaIngresada) {
      hora_llegada = llegadaIngresada
      const [salidaH, salidaM] = hora_salida.split(':').map(Number)
      const [llegadaH, llegadaM] = llegadaIngresada.split(':').map(Number)
      duracion_min = llegadaH * 60 + llegadaM - (salidaH * 60 + salidaM)
      if (duracion_min < 0) duracion_min += 1440
    } else if (duracionIngresada !== undefined && duracionIngresada !== null && duracionIngresada !== '') {
      duracion_min = Number(duracionIngresada)
      hora_llegada = sumarMinutos(hora_salida, duracion_min)
    }

    if (paradas.length) {
      try {
        const horario = await calcularHorarioRecorrido(origen.trim(), destino.trim(), paradas, hora_salida)
        paradas.splice(0, paradas.length, ...horario.paradas)
        ;({ hora_llegada, duracion_min, distancia_km } = horario)
      } catch (error) {
        const status = error.code === 'HORARIO_MEDIANOCHE' ? 400 : 503
        return res.status(status).json({ mensaje: error.message })
      }
    }

    if (paradas.some((p) => p.hora_estimada >= hora_llegada)) {
      return res.status(400).json({ mensaje: 'Todas las paradas deben ocurrir antes de la llegada al destino final' })
    }
    if (paradas.length) {
      try {
        const rutaCompleta = await calcularRuta(origen.trim(), destino.trim())
        if (rutaCompleta.aproximada) return res.status(503).json({ mensaje: 'No pudimos validar el orden geográfico de las paradas ahora. Probá de nuevo en unos minutos' })
        let posicionAnterior = 0
        for (const parada of paradas) {
          const centro = await centroLocalidad(parada.localidad.trim())
          const posicion = ubicarEnRuta(rutaCompleta.geometria, centro).s
          if (posicion <= posicionAnterior) return res.status(400).json({ mensaje: `La parada ${parada.localidad} no respeta el orden geográfico del recorrido` })
          posicionAnterior = posicion
        }
      } catch {
        return res.status(503).json({ mensaje: 'No pudimos validar el recorrido en el mapa ahora. Probá de nuevo en unos minutos' })
      }
    }

    // Fechas a crear: una sola si el viaje es unico, o todas las ocurrencias si se repite.
    const fechas = generarFechas(fecha, repeticion)
    const esSerie = fechas.length > 1 || (repeticion?.tipo && repeticion.tipo !== 'unico')

    // Criterio de aceptacion: no se pueden crear dos viajes del mismo comisionista
    // que se superpongan en horario el mismo dia. Se chequean TODAS las fechas antes
    // de insertar nada, para no dejar una serie a medias.
    const { rows: existentes } = await query(
      `SELECT fecha::text AS fecha, hora_salida, hora_llegada FROM viajes
       WHERE usuario_id = $1 AND fecha BETWEEN $2::date AND $3::date AND estado <> 'cancelado'`,
      [usuarioId, desplazarFecha(fechas[0], -1), desplazarFecha(fechas.at(-1), 1)]
    )

    const fechasConflicto = fechas.filter((fechaViaje) => {
      const rangoNuevo = rangoViaje(fechaViaje, hora_salida, hora_llegada)
      return existentes.some((viaje) => seSuperponen(
        rangoNuevo,
        rangoViaje(viaje.fecha, viaje.hora_salida, viaje.hora_llegada),
      ))
    }).sort()

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
                               distancia_km, duracion_min, cupo_total, serie_id, repeticion_dias)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [usuarioId, origen.trim(), destino.trim(), f, hora_salida, hora_llegada,
           distancia_km, duracion_min, cupo_total ?? 0, serieId, repeticionDias]
        )
        for (let i = 0; i < paradas.length; i++) {
          const parada = paradas[i]
          await cliente.query(
            `INSERT INTO paradas_viaje (viaje_id, orden, localidad, hora_estimada) VALUES ($1, $2, $3, $4)`,
            [rows[0].id, i + 1, parada.localidad.trim(), parada.hora_estimada],
          )
        }
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
      'SELECT id, estado, fecha::text AS fecha, serie_id FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    const viaje = rows[0]
    if (obtenerEstadoViaje(viaje.estado, viaje.fecha) !== 'programado') {
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
        ? " AND fecha >= (NOW() AT TIME ZONE 'America/Argentina/Cordoba')::date"
        : ''
      const resultado = await cliente.query(
        `UPDATE viajes SET estado = 'cancelado'
         WHERE ${condicion} AND usuario_id = $2 AND estado = 'programado'${soloPendientes}
         RETURNING *`,
        valores
      )
      cancelados = resultado.rows
      if (cancelados.length > 0) {
        await cliente.query(
          `UPDATE recordatorios_viaje SET estado = 'cancelado', procesamiento_iniciado_en = NULL, actualizado_en = NOW()
           WHERE viaje_id = ANY($1::int[]) AND estado IN ('pendiente', 'procesando')`,
          [cancelados.map((v) => v.id)],
        )
        await cliente.query(
          `INSERT INTO notificaciones (usuario_id, viaje_id, titulo, mensaje)
           SELECT DISTINCT c.usuario_id, v.id, 'Viaje cancelado',
             'El comisionista canceló el viaje ' || v.origen || ' → ' || v.destino || ' del ' || to_char(v.fecha, 'DD/MM/YYYY') || '.'
           FROM solicitudes_viaje s
           JOIN clientes c ON c.id = s.cliente_id
           JOIN viajes v ON v.id = s.viaje_id
           WHERE v.id = ANY($1::int[]) AND s.estado IN ('pendiente', 'aceptada')`,
          [cancelados.map((v) => v.id)],
        )
      }
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

// US18: modifica solo horarios/capacidad y notifica en forma persistente a los clientes afectados.
export async function actualizar(req, res, next) {
  const cliente = await pool.connect()
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id
    const { hora_salida, cupo_total, paradas } = req.body
    let hora_llegada = req.body.hora_llegada
    await cliente.query('BEGIN')
    const { rows } = await cliente.query(
      'SELECT id, origen, destino, estado, fecha::text AS fecha, hora_salida, hora_llegada, cupo_total FROM viajes WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
      [id, usuarioId],
    )
    if (!rows.length) { await cliente.query('ROLLBACK'); return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` }) }
    const viaje = rows[0]
    if (obtenerEstadoViaje(viaje.estado, viaje.fecha) !== 'programado') {
      await cliente.query('ROLLBACK')
      return res.status(409).json({ mensaje: 'Solo se pueden modificar viajes en estado Programado' })
    }
    const { rows: paradasAnteriores } = await cliente.query(
      "SELECT id, orden, localidad, to_char(hora_estimada, 'HH24:MI') AS hora_estimada FROM paradas_viaje WHERE viaje_id = $1 ORDER BY orden", [id],
    )
    const paradasRecibidas = paradas ?? paradasAnteriores.map((p) => ({ ...p }))
    let duracionActualizada = null
    let distanciaActualizada = null
    if (paradasAnteriores.length || paradasRecibidas.length) {
      try {
        const horario = await calcularHorarioRecorrido(viaje.origen, viaje.destino, paradasRecibidas, hora_salida)
        paradasRecibidas.splice(0, paradasRecibidas.length, ...horario.paradas)
        hora_llegada = horario.hora_llegada
        duracionActualizada = horario.duracion_min
        distanciaActualizada = horario.distancia_km
      } catch (error) {
        await cliente.query('ROLLBACK')
        const status = error.code === 'HORARIO_MEDIANOCHE' ? 400 : 503
        return res.status(status).json({ mensaje: error.message })
      }
    }
    if (paradas !== undefined && paradas.length) {
      const localidades = new Set([viaje.origen.trim().toLocaleLowerCase(), viaje.destino.trim().toLocaleLowerCase()])
      for (const parada of paradas) {
        const clave = parada.localidad.trim().toLocaleLowerCase()
        if (localidades.has(clave)) {
          await cliente.query('ROLLBACK')
          return res.status(400).json({ mensaje: 'No repitas el origen, el destino ni localidades en el recorrido' })
        }
        localidades.add(clave)
      }
      try {
        const ruta = await calcularRuta(viaje.origen, viaje.destino)
        if (ruta.aproximada) throw new Error('ruta no disponible')
        let anterior = 0
        for (const parada of paradas) {
          const centro = await centroLocalidad(parada.localidad.trim())
          const posicion = ubicarEnRuta(ruta.geometria, centro).s
          if (posicion <= anterior) throw new Error(`La parada ${parada.localidad} no respeta el orden geográfico del recorrido`)
          anterior = posicion
        }
      } catch (error) {
        await cliente.query('ROLLBACK')
        const status = error.message.startsWith('La parada ') ? 400 : 503
        return res.status(status).json({ mensaje: status === 400 ? error.message : 'No pudimos validar el recorrido en el mapa ahora. Probá de nuevo en unos minutos' })
      }
    }
    const { rows: ocupacion } = await cliente.query(`SELECT ${SQL_OCUPADOS} AS ocupados FROM viajes v WHERE v.id = $1`, [id])
    const ocupados = ocupacion[0].ocupados
    if (ocupados > cupo_total) {
      await cliente.query('ROLLBACK')
      return res.status(409).json({ mensaje: `El cupo no puede ser menor que los ${ocupados} pasajeros que ya tiene asociados el viaje` })
    }
    const { rows: existentes } = await cliente.query(
      `SELECT fecha::text AS fecha, hora_salida, hora_llegada FROM viajes
       WHERE usuario_id = $1 AND fecha BETWEEN $2::date AND $3::date AND estado <> 'cancelado' AND id <> $4`,
      [usuarioId, desplazarFecha(viaje.fecha, -1), desplazarFecha(viaje.fecha, 1), id],
    )
    if (existentes.some((v) => seSuperponen(
      rangoViaje(viaje.fecha, hora_salida, hora_llegada),
      rangoViaje(v.fecha, v.hora_salida, v.hora_llegada),
    ))) {
      await cliente.query('ROLLBACK')
      return res.status(409).json({ mensaje: 'Ya tenés un viaje programado que se superpone con ese horario ese mismo día' })
    }
    const { rows: actualizados } = await cliente.query(
      `UPDATE viajes SET hora_salida = $1, hora_llegada = $2,
       duracion_min = COALESCE($6, EXTRACT(EPOCH FROM ($2::time - $1::time))::int / 60),
       distancia_km = COALESCE($7, distancia_km), cupo_total = $3
       WHERE id = $4 AND usuario_id = $5 AND estado = 'programado' RETURNING *`,
      [hora_salida, hora_llegada, cupo_total, id, usuarioId, duracionActualizada, distanciaActualizada],
    )
    if (paradas !== undefined || paradasAnteriores.length) {
      const idsExistentes = new Set(paradasAnteriores.map((p) => Number(p.id)))
      const idsConservados = []
      if (paradasAnteriores.length) await cliente.query('UPDATE paradas_viaje SET orden = orden + 100000 WHERE viaje_id = $1', [id])
      for (let i = 0; i < paradasRecibidas.length; i++) {
        const parada = paradasRecibidas[i]
        const paradaId = Number(parada.id)
        if (Number.isSafeInteger(paradaId) && idsExistentes.has(paradaId) && !idsConservados.includes(paradaId)) {
          await cliente.query('UPDATE paradas_viaje SET orden = $1, localidad = $2, hora_estimada = $3 WHERE id = $4 AND viaje_id = $5',
            [i + 1, parada.localidad.trim(), parada.hora_estimada, paradaId, id])
          idsConservados.push(paradaId)
        } else {
          const { rows: insertadas } = await cliente.query('INSERT INTO paradas_viaje (viaje_id, orden, localidad, hora_estimada) VALUES ($1, $2, $3, $4) RETURNING id',
            [id, i + 1, parada.localidad.trim(), parada.hora_estimada])
          idsConservados.push(Number(insertadas[0].id))
        }
      }
      const idsRemovidos = [...idsExistentes].filter((paradaId) => !idsConservados.includes(paradaId))
      if (idsRemovidos.length) await cliente.query('DELETE FROM paradas_viaje WHERE viaje_id = $1 AND id = ANY($2::int[])', [id, idsRemovidos])
    }
    const cambioHorario = viaje.hora_salida?.slice(0, 5) !== hora_salida || viaje.hora_llegada?.slice(0, 5) !== hora_llegada
    const paradasNuevas = paradas?.map((p) => ({ id: p.id ?? null, localidad: p.localidad.trim(), hora_estimada: p.hora_estimada.slice(0, 5) }))
    const paradasPreviasNormalizadas = paradasAnteriores.map(({ id: paradaId, localidad, hora_estimada }) => ({ id: paradaId, localidad, hora_estimada }))
    const cambioParadas = paradasNuevas !== undefined && JSON.stringify(paradasNuevas) !== JSON.stringify(paradasPreviasNormalizadas)
    const huboCambio = cambioHorario || cambioParadas || Number(viaje.cupo_total) !== cupo_total
    if (huboCambio) {
      if (cambioHorario) {
        await cliente.query(
          `UPDATE recordatorios_viaje SET programado_para = (($1::date + $2::time) AT TIME ZONE 'America/Argentina/Buenos_Aires')
           - make_interval(mins => minutos_anticipacion), actualizado_en = NOW() WHERE viaje_id = $3 AND estado = 'pendiente'`,
          [viaje.fecha, hora_salida, id],
        )
      }
      const { rows: destinatarios } = await cliente.query(
        `SELECT DISTINCT cliente_usuario_id FROM (
          SELECT c.usuario_id AS cliente_usuario_id FROM solicitudes_viaje s JOIN clientes c ON c.id = s.cliente_id
          WHERE s.viaje_id = $1 AND s.estado = 'aceptada' AND s.tipo = 'pasajero'
          UNION
          SELECT c.usuario_id FROM solicitudes_viaje s JOIN clientes c ON c.id = s.cliente_id
          WHERE s.viaje_id = $1 AND s.estado = 'aceptada' AND s.tipo = 'encomienda'
          UNION
          SELECT c.usuario_id FROM encomiendas e JOIN clientes c ON c.id = e.cliente_remitente_id WHERE e.viaje_id = $1
        ) afectados WHERE cliente_usuario_id IS NOT NULL`, [id],
      )
      const mensaje = `El comisionista modificó el viaje ${id}. Nueva hora de salida: ${hora_salida} hs. Nueva hora estimada de llegada: ${hora_llegada} hs. El origen (${viaje.origen}) y el destino (${viaje.destino}) no cambiaron. Consultá el viaje actualizado en ComiTrack.`
      for (const destinatario of destinatarios) {
        await cliente.query('INSERT INTO notificaciones (usuario_id, viaje_id, titulo, mensaje) VALUES ($1, $2, $3, $4)',
          [destinatario.cliente_usuario_id, id, 'Tu viaje ha sido modificado', mensaje])
      }
    }
    const clientesNotificados = huboCambio ? (await cliente.query(
      `SELECT COUNT(DISTINCT usuario_id)::int AS cantidad FROM notificaciones WHERE viaje_id = $1 AND creado_en >= transaction_timestamp()`, [id],
    )).rows[0].cantidad : 0
    await cliente.query('COMMIT')
    res.status(200).json({ ...actualizados[0], clientesNotificados })
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {})
    next(error)
  } finally { cliente.release() }
}

// US20 - Iniciar viaje.
// Marca formalmente el comienzo del trayecto: el viaje pasa de "Programado" a "En curso".
// Reglas: el viaje debe ser del comisionista, estar programado (no cancelado, vencido ni ya
// iniciado), corresponder al dia de hoy (zona horaria de Cordoba) y el comisionista no puede
// tener otro viaje en curso. El UPDATE es condicional para evitar dobles inicios concurrentes.
export async function iniciar(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      'SELECT id, estado, fecha::text AS fecha FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    const viaje = rows[0]
    const estadoVisible = obtenerEstadoViaje(viaje.estado, viaje.fecha)
    if (estadoVisible === 'en_curso') {
      return res.status(409).json({ mensaje: 'El viaje ya fue iniciado' })
    }
    if (estadoVisible !== 'programado') {
      const motivo = estadoVisible === 'vencido'
        ? 'El viaje está vencido: su fecha ya pasó'
        : 'Solo se pueden iniciar viajes en estado Programado'
      return res.status(409).json({ mensaje: motivo })
    }
    if (viaje.fecha !== hoyEnCordoba()) {
      return res.status(409).json({ mensaje: 'Solo se puede iniciar un viaje el día en que está programado' })
    }

    const { rows: enCurso } = await query(
      `SELECT id FROM viajes WHERE usuario_id = $1 AND estado = 'en_curso' AND id <> $2 LIMIT 1`,
      [usuarioId, id]
    )
    if (enCurso.length > 0) {
      return res.status(409).json({
        mensaje: `Ya tenés un viaje en curso (N° ${String(enCurso[0].id).padStart(4, '0')}). Finalizalo antes de iniciar otro`,
        viaje_en_curso_id: enCurso[0].id,
      })
    }

    const { rows: actualizados } = await query(
      `UPDATE viajes SET estado = 'en_curso', iniciado_en = NOW()
       WHERE id = $1 AND usuario_id = $2 AND estado = 'programado'
       RETURNING *`,
      [id, usuarioId]
    )
    if (actualizados.length === 0) {
      return res.status(409).json({ mensaje: 'El viaje ya no está en estado Programado' })
    }

    res.status(200).json({ ...actualizados[0], fecha: viaje.fecha, mensaje: 'Viaje iniciado correctamente' })
  } catch (e) { next(e) }
}

// US21 - Finalizar viaje.
// Da por concluido el recorrido: el viaje pasa de "En curso" a "Finalizado" y queda registrada
// la fecha y hora de finalizacion. Solo se puede finalizar un viaje que fue iniciado.
export async function finalizar(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.usuario?.id

    const { rows } = await query(
      'SELECT id, estado, fecha::text AS fecha FROM viajes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: `Viaje ${id} no encontrado` })
    }

    const viaje = rows[0]
    if (viaje.estado === 'finalizado') {
      return res.status(409).json({ mensaje: 'El viaje ya fue finalizado' })
    }
    if (viaje.estado !== 'en_curso') {
      return res.status(409).json({ mensaje: 'Solo se pueden finalizar viajes en estado En curso. Iniciá el viaje primero' })
    }

    const { rows: actualizados } = await query(
      `UPDATE viajes SET estado = 'finalizado', finalizado_en = NOW()
       WHERE id = $1 AND usuario_id = $2 AND estado = 'en_curso'
       RETURNING *`,
      [id, usuarioId]
    )
    if (actualizados.length === 0) {
      return res.status(409).json({ mensaje: 'El viaje ya no está en estado En curso' })
    }

    res.status(200).json({ ...actualizados[0], fecha: viaje.fecha, mensaje: 'Viaje finalizado correctamente' })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    res.status(501).json({ mensaje: `eliminar viaje ${req.params.id}: pendiente (US11)` })
  } catch (e) { next(e) }
}
