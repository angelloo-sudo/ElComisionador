// Reglas de negocio compartidas sobre viajes.
import { query, pool } from '../config/db.js'
import { fechaFinRepeticion } from '../validators/viaje.validador.js'

// Superposicion de horarios: cada viaje ocupa el bloque [hora_salida, hora_llegada].
// Los viajes viejos (cargados antes de existir hora_llegada) no tienen ese dato, asi
// que para ellos se asume un bloque de DURACION_POR_DEFECTO_MINUTOS desde la salida.
const DURACION_POR_DEFECTO_MINUTOS = 60

function aMinutos(hora) {
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function rangoViaje(horaSalida, horaLlegada) {
  const inicio = aMinutos(horaSalida)
  const fin = horaLlegada ? aMinutos(horaLlegada) : inicio + DURACION_POR_DEFECTO_MINUTOS
  return { inicio, fin }
}

export function seSuperponen(rangoA, rangoB) {
  return rangoA.inicio < rangoB.fin && rangoB.inicio < rangoA.fin
}

// US16: un viaje cancelado (o ya iniciado/finalizado) no admite nuevas asociaciones.
// Usar esta funcion antes de asociar un pasajero (US19) o una encomienda (Epica 5) a un viaje.
export async function viajeAdmiteAsociaciones(viajeId) {
  const { rows } = await query('SELECT estado FROM viajes WHERE id = $1', [viajeId])
  return rows.length > 0 && rows[0].estado === 'programado'
}

// Viajes repetitivos "hasta que se cancelen".
// Una serie sigue viva mientras su ULTIMO viaje conserve repeticion_dias. Al cancelar
// "este y los siguientes" o "toda la serie" se limpia ese campo y la serie deja de extenderse.
// Cada vez que se llama, completa la serie hasta 3 meses desde hoy, copiando los datos del
// ultimo viaje. Es seguro llamarla seguido: si ya esta completa no hace nada.
// Devuelve la cantidad de viajes creados. Sin usuarioId revisa las series de todos.
export async function extenderSeries({ usuarioId } = {}) {
  const { rows: [{ hoy }] } = await query('SELECT CURRENT_DATE::text AS hoy')
  const hasta = fechaFinRepeticion(hoy).toISOString().slice(0, 10)

  const { rows: candidatas } = await query(
    `SELECT DISTINCT ON (serie_id) serie_id, fecha::text AS fecha, repeticion_dias
     FROM viajes
     WHERE serie_id IS NOT NULL ${usuarioId ? 'AND usuario_id = $1' : ''}
     ORDER BY serie_id, fecha DESC, hora_salida DESC`,
    usuarioId ? [usuarioId] : []
  )

  let creados = 0
  for (const s of candidatas) {
    if (s.repeticion_dias && s.fecha < hasta) creados += await extenderSerie(s.serie_id, hasta)
  }
  return creados
}

async function extenderSerie(serieId, hasta) {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // Evita que dos pedidos simultaneos extiendan la misma serie y la dupliquen.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(serieId)])

    const { rows } = await cliente.query(
      `SELECT usuario_id, origen, destino, fecha::text AS fecha, hora_salida, hora_llegada,
              cupo_total, repeticion_dias
       FROM viajes WHERE serie_id = $1
       ORDER BY fecha DESC, hora_salida DESC LIMIT 1`,
      [serieId]
    )
    const ultimo = rows[0]
    if (!ultimo || !ultimo.repeticion_dias || ultimo.fecha >= hasta) {
      await cliente.query('COMMIT')
      return 0
    }

    const dias = ultimo.repeticion_dias === 'todos'
      ? [0, 1, 2, 3, 4, 5, 6]
      : ultimo.repeticion_dias.split(',').map(Number)
    const fechas = []
    const d = new Date(`${ultimo.fecha}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    for (; d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
      if (dias.includes(d.getUTCDay())) fechas.push(d.toISOString().slice(0, 10))
    }
    if (fechas.length === 0) {
      await cliente.query('COMMIT')
      return 0
    }

    // Si justo ese dia el comisionista tiene otro viaje que se superpone, se saltea esa fecha.
    const { rows: existentes } = await cliente.query(
      `SELECT fecha::text AS fecha, hora_salida, hora_llegada FROM viajes
       WHERE usuario_id = $1 AND fecha = ANY($2::date[]) AND estado <> 'cancelado'`,
      [ultimo.usuario_id, fechas]
    )
    const rangoNuevo = rangoViaje(ultimo.hora_salida, ultimo.hora_llegada)
    const ocupadas = new Set(
      existentes
        .filter((v) => seSuperponen(rangoNuevo, rangoViaje(v.hora_salida, v.hora_llegada)))
        .map((v) => v.fecha.slice(0, 10))
    )
    const libres = fechas.filter((f) => !ocupadas.has(f))

    if (libres.length > 0) {
      await cliente.query(
        `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada,
                             cupo_total, serie_id, repeticion_dias)
         SELECT $1, $2, $3, f, $4, $5, $6, $7, $8 FROM unnest($9::date[]) AS f`,
        [ultimo.usuario_id, ultimo.origen, ultimo.destino, ultimo.hora_salida, ultimo.hora_llegada,
         ultimo.cupo_total, serieId, ultimo.repeticion_dias, libres]
      )
    }
    await cliente.query('COMMIT')
    return libres.length
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}
