// Resumen (pantalla de inicio). Una sola consulta de la API arma lo importante segun el rol:
//  - comisionista: proximo viaje, solicitudes por responder, agenda, cupos, gastos del mes y alertas.
//  - cliente: proximo traslado, estado de sus solicitudes, cuanto tiene que pagar y sus ultimos movimientos.
// Solo lee datos que ya existen (no agrega nada a la base).
import { query } from '../config/db.js'
import { SQL_OCUPADOS } from '../services/viajes.service.js'

const TZ = "NOW() AT TIME ZONE 'America/Argentina/Cordoba'"
const INICIO = "(v.fecha + COALESCE(v.hora_salida, TIME '00:00'))"
const nombreCompleto = (n, a) => `${n ?? ''} ${a ?? ''}`.trim()
const suma = (lista, f) => lista.reduce((t, x) => t + (Number(f(x)) || 0), 0)

// GET /api/resumen
export async function resumen(req, res, next) {
  try {
    res.json(req.usuario.rol === 'cliente' ? await resumenCliente(req.usuario.id) : await resumenComisionista(req.usuario.id))
  } catch (e) { next(e) }
}

async function resumenComisionista(usuarioId) {
  // Viajes programados que todavia no salieron, del mas cercano al mas lejano.
  const { rows: viajes } = await query(
    `SELECT v.id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.duracion_min, v.distancia_km, v.cupo_total,
            ${SQL_OCUPADOS} AS ocupados,
            (v.fecha = (${TZ})::date) AS es_hoy,
            (v.fecha <= (${TZ})::date + 6) AS esta_semana,
            ROUND(EXTRACT(EPOCH FROM (${INICIO} - (${TZ}))) / 3600)::int AS horas_para_salir,
            (SELECT COUNT(*)::int FROM solicitudes_viaje s WHERE s.viaje_id = v.id AND s.estado = 'pendiente') AS pendientes,
            (SELECT COUNT(*)::int FROM solicitudes_viaje s WHERE s.viaje_id = v.id AND s.estado = 'aceptada'
               AND ((s.origen_localidad IS NOT NULL AND s.origen_localidad <> v.origen)
                 OR (s.destino_localidad IS NOT NULL AND s.destino_localidad <> v.destino))) AS con_paradas,
            (SELECT COUNT(*)::int FROM solicitudes_viaje s WHERE s.viaje_id = v.id AND s.estado = 'aceptada' AND s.tipo = 'encomienda') AS encomiendas
     FROM viajes v
     WHERE v.usuario_id = $1 AND v.estado = 'programado' AND ${INICIO} > (${TZ})
     ORDER BY ${INICIO}, v.id`,
    [usuarioId],
  )

  const { rows: pendientes } = await query(
    `SELECT s.id, s.tipo, s.cantidad_pasajeros, s.creado_en, s.nombre, s.apellido, s.emisor_nombre, s.emisor_apellido,
            s.origen_localidad, s.destino_localidad, v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida
     FROM solicitudes_viaje s JOIN viajes v ON v.id = s.viaje_id
     WHERE v.usuario_id = $1 AND s.estado = 'pendiente' AND v.estado = 'programado' AND ${INICIO} > (${TZ})
     ORDER BY s.creado_en DESC LIMIT 5`,
    [usuarioId],
  )

  const { rows: tarifa } = await query('SELECT precio_km FROM comisionistas WHERE usuario_id = $1', [usuarioId])

  let gastosMes = null
  try {
    const { rows } = await query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM gastos
       WHERE usuario_id = $1 AND date_trunc('month', fecha) = date_trunc('month', (${TZ})::date)`,
      [usuarioId],
    )
    gastosMes = Number(rows[0].total)
  } catch { /* si la tabla de gastos no existe todavia, la tarjeta no se muestra */ }

  const completo = (v) => ({ ...v, libres: v.cupo_total == null ? null : Math.max(v.cupo_total - v.ocupados, 0) })
  return {
    rol: 'comisionista',
    precio_km: tarifa[0]?.precio_km != null ? Number(tarifa[0].precio_km) : null,
    proximo_viaje: viajes[0] ? completo(viajes[0]) : null,
    agenda: viajes.slice(0, 5).map(completo),
    totales: {
      viajes_programados: viajes.length,
      viajes_hoy: viajes.filter((v) => v.es_hoy).length,
      viajes_semana: viajes.filter((v) => v.esta_semana).length,
      solicitudes_pendientes: suma(viajes, (v) => v.pendientes),
      cupos_libres: suma(viajes, (v) => completo(v).libres),
      encomiendas_en_curso: suma(viajes, (v) => v.encomiendas),
      gastos_mes: gastosMes,
    },
    pendientes: pendientes.map((s) => ({
      id: s.id, tipo: s.tipo, cantidad_pasajeros: s.tipo === 'pasajero' ? s.cantidad_pasajeros : null, creado_en: s.creado_en,
      quien: s.tipo === 'encomienda' ? nombreCompleto(s.emisor_nombre, s.emisor_apellido) : nombreCompleto(s.nombre, s.apellido),
      sube: s.origen_localidad ?? s.origen, baja: s.destino_localidad ?? s.destino,
      viaje_id: s.viaje_id, origen: s.origen, destino: s.destino, fecha: s.fecha, hora_salida: s.hora_salida,
    })),
    alertas: {
      sin_tarifa: tarifa[0]?.precio_km == null,
      viajes_sin_ruta: viajes.filter((v) => v.distancia_km == null).length,
      // Salen en menos de 48 horas y tienen solicitudes sin responder.
      pendientes_urgentes: viajes.filter((v) => v.pendientes > 0 && v.horas_para_salir <= 48).map((v) => ({
        viaje_id: v.id, origen: v.origen, destino: v.destino, fecha: v.fecha, hora_salida: v.hora_salida, pendientes: v.pendientes,
      })),
    },
  }
}

async function resumenCliente(usuarioId) {
  const { rows } = await query(
    `SELECT s.id, s.tipo, s.estado, s.monto, s.cantidad_pasajeros, s.motivo_rechazo, s.creado_en, s.origen_localidad, s.destino_localidad,
            v.id AS viaje_id, v.origen, v.destino, v.fecha::text AS fecha, v.hora_salida, v.estado AS estado_viaje,
            (${INICIO} > (${TZ})) AS futuro,
            u.nombre AS comisionista_nombre, u.apellido AS comisionista_apellido
     FROM solicitudes_viaje s
     JOIN clientes c ON c.id = s.cliente_id
     JOIN viajes v ON v.id = s.viaje_id
     JOIN usuarios u ON u.id = v.usuario_id
     WHERE c.usuario_id = $1
     ORDER BY s.creado_en DESC`,
    [usuarioId],
  )
  const { rows: [disp] } = await query(
    `SELECT COUNT(*)::int AS n FROM viajes v JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.estado = 'programado' AND u.rol = 'comisionista' AND u.activo = true AND ${INICIO} > (${TZ})`,
  )

  const vigentes = rows.filter((s) => ['pendiente', 'aceptada'].includes(s.estado) && s.estado_viaje === 'programado' && s.futuro)
  const aceptadas = vigentes.filter((s) => s.estado === 'aceptada')
  const pendientes = vigentes.filter((s) => s.estado === 'pendiente')
  const orden = (a, b) => `${a.fecha} ${a.hora_salida ?? ''}`.localeCompare(`${b.fecha} ${b.hora_salida ?? ''}`)
  const treintaDias = Date.now() - 30 * 24 * 60 * 60 * 1000
  const simple = (s) => ({
    id: s.id, tipo: s.tipo, estado: s.estado, monto: s.monto != null ? Number(s.monto) : null, cantidad_pasajeros: s.cantidad_pasajeros,
    motivo_rechazo: s.motivo_rechazo, viaje_id: s.viaje_id, origen: s.origen, destino: s.destino,
    sube: s.origen_localidad ?? s.origen, baja: s.destino_localidad ?? s.destino,
    fecha: s.fecha, hora_salida: s.hora_salida, estado_viaje: s.estado_viaje,
    comisionista: nombreCompleto(s.comisionista_nombre, s.comisionista_apellido),
  })
  return {
    rol: 'cliente',
    proximo_traslado: aceptadas.length ? simple([...aceptadas].sort(orden)[0]) : null,
    totales: {
      pendientes: pendientes.length,
      aceptadas: aceptadas.length,
      rechazadas_recientes: rows.filter((s) => s.estado === 'rechazada' && new Date(s.creado_en).getTime() >= treintaDias).length,
      // Lo que tiene que pagar por las solicitudes aceptadas y lo que quedaria si se aceptan las pendientes.
      a_pagar_aceptadas: suma(aceptadas, (s) => s.monto),
      a_pagar_pendientes: suma(pendientes, (s) => s.monto),
      a_convenir: vigentes.filter((s) => s.monto == null).length,
      viajes_disponibles: disp.n,
    },
    ultimas: rows.slice(0, 5).map(simple),
  }
}
