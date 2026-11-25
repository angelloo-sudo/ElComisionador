import { query } from '../config/db.js'

const ROLES_GESTIONABLES = ['cliente', 'comisionista']
const LIMITE_MAXIMO = 50

const ACTIVIDAD_SQL = `
  SELECT * FROM (
    SELECT u.creado_en::timestamptz AS fecha,
           CASE WHEN u.rol = 'comisionista' THEN 'comisionista_nuevo' ELSE 'cliente_nuevo' END AS tipo,
           u.id AS referencia_id, CONCAT_WS(' ', u.nombre, u.apellido) AS sujeto,
           u.email, 'Cuenta registrada'::text AS detalle, NULL::text AS administrador, NULL::text AS motivo
    FROM usuarios u
    WHERE u.rol = ANY($1::text[])

    UNION ALL

    SELECT v.enviada_en AS fecha, 'verificacion_pendiente'::text AS tipo,
           v.id AS referencia_id, CONCAT_WS(' ', u.nombre, u.apellido) AS sujeto,
           u.email, 'Identidad pendiente de revisión'::text AS detalle,
           NULL::text AS administrador, NULL::text AS motivo
    FROM verificaciones_identidad v
    JOIN usuarios u ON u.id = v.usuario_id
    WHERE u.rol = 'comisionista' AND v.estado = 'PENDIENTE_REVISION' AND v.enviada_en IS NOT NULL

    UNION ALL

    SELECT v.resuelta_en AS fecha,
           CASE v.estado
             WHEN 'APROBADA_MANUALMENTE' THEN 'identidad_aprobada'
             WHEN 'REQUIERE_CORRECCION' THEN 'identidad_corregir'
             ELSE 'identidad_rechazada'
           END AS tipo,
           v.id AS referencia_id, CONCAT_WS(' ', u.nombre, u.apellido) AS sujeto,
           u.email, v.estado AS detalle, CONCAT_WS(' ', admin.nombre, admin.apellido) AS administrador,
           v.motivo_resolucion AS motivo
    FROM verificaciones_identidad v
    JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN usuarios admin ON admin.id = v.resuelta_por
    WHERE u.rol = 'comisionista'
      AND v.estado IN ('APROBADA_MANUALMENTE', 'RECHAZADA', 'REQUIERE_CORRECCION')
      AND v.resuelta_en IS NOT NULL

    UNION ALL

    SELECT v.creado_en::timestamptz AS fecha, 'viaje_publicado'::text AS tipo,
           v.id AS referencia_id, CONCAT_WS(' ', u.nombre, u.apellido) AS sujeto,
           u.email, CONCAT_WS(' → ', v.origen, v.destino) AS detalle,
           NULL::text AS administrador, NULL::text AS motivo
    FROM viajes v
    JOIN usuarios u ON u.id = v.usuario_id

    UNION ALL

    SELECT s.creado_en::timestamptz AS fecha, 'encomienda_registrada'::text AS tipo,
           s.id AS referencia_id,
           COALESCE(NULLIF(CONCAT_WS(' ', u.nombre, u.apellido), ''), 'Cliente') AS sujeto,
           u.email, CONCAT('Encomienda #', s.id)::text AS detalle,
           NULL::text AS administrador, NULL::text AS motivo
    FROM solicitudes_viaje s
    LEFT JOIN clientes c ON c.id = s.cliente_id
    LEFT JOIN usuarios u ON u.id = c.usuario_id
    WHERE s.tipo = 'encomienda'
  ) actividad
  ORDER BY fecha DESC NULLS LAST, referencia_id DESC
  LIMIT $2
`

export async function resumen(req, res, next) {
  try {
    const [estadisticas, registros, actividad] = await Promise.all([
      query(
        `WITH ultima_verificacion AS (
           SELECT DISTINCT ON (v.usuario_id) v.usuario_id, v.estado
           FROM verificaciones_identidad v
           JOIN usuarios u ON u.id = v.usuario_id AND u.rol = 'comisionista'
           ORDER BY v.usuario_id, v.iniciada_en DESC, v.id DESC
         )
         SELECT
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'cliente') AS clientes,
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'comisionista') AS comisionistas,
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'comisionista' AND activo = true) AS comisionistas_activos,
           (SELECT COUNT(*)::int FROM ultima_verificacion WHERE estado = 'PENDIENTE_REVISION') AS comisionistas_pendientes,
           (SELECT COUNT(*)::int FROM ultima_verificacion WHERE estado = 'APROBADA_MANUALMENTE') AS comisionistas_aprobados,
           (SELECT COUNT(*)::int FROM ultima_verificacion WHERE estado = 'RECHAZADA') AS comisionistas_rechazados,
           (SELECT COUNT(*)::int FROM ultima_verificacion WHERE estado = 'EN_PROCESO') AS comisionistas_en_proceso,
           (SELECT COUNT(*)::int FROM ultima_verificacion WHERE estado = 'REQUIERE_CORRECCION') AS comisionistas_requieren_correccion,
           (SELECT COUNT(*)::int FROM viajes) AS viajes_total,
           (SELECT COUNT(*)::int FROM viajes WHERE estado IN ('programado', 'en_curso')) AS viajes_activos,
           (SELECT COUNT(*)::int FROM viajes WHERE estado = 'programado') AS viajes_programados,
           (SELECT COUNT(*)::int FROM viajes WHERE estado = 'en_curso') AS viajes_en_curso,
           (SELECT COUNT(*)::int FROM viajes WHERE estado = 'finalizado') AS viajes_finalizados,
           -- Encomiendas reales: las que piden los clientes como solicitudes de tipo encomienda.
           (SELECT COUNT(*)::int FROM solicitudes_viaje WHERE tipo = 'encomienda') AS encomiendas_total,
           (SELECT COUNT(*)::int FROM solicitudes_viaje WHERE tipo = 'encomienda' AND estado = 'pendiente') AS encomiendas_pendientes,
           (SELECT COUNT(*)::int FROM solicitudes_viaje WHERE tipo = 'encomienda' AND entregada_en IS NOT NULL) AS encomiendas_entregadas`,
      ),
      query(
        `WITH meses AS (
           SELECT generate_series(
             date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
             date_trunc('month', CURRENT_DATE),
             INTERVAL '1 month'
           ) AS mes
         )
         SELECT to_char(meses.mes, 'YYYY-MM') AS mes,
                (SELECT COUNT(*)::int FROM usuarios u
                 WHERE u.rol = 'cliente' AND u.creado_en >= meses.mes
                   AND u.creado_en < meses.mes + INTERVAL '1 month') AS clientes,
                (SELECT COUNT(*)::int FROM usuarios u
                 WHERE u.rol = 'comisionista' AND u.creado_en >= meses.mes
                   AND u.creado_en < meses.mes + INTERVAL '1 month') AS comisionistas
         FROM meses ORDER BY meses.mes`,
      ),
      query(ACTIVIDAD_SQL, [ROLES_GESTIONABLES, 8]),
    ])

    res.json({
      estadisticas: estadisticas.rows[0],
      registros: registros.rows,
      actividad: actividad.rows,
    })
  } catch (error) { next(error) }
}

export async function listarUsuarios(req, res, next) {
  try {
    const rol = req.query.rol || null
    if (rol && !ROLES_GESTIONABLES.includes(rol)) {
      return res.status(400).json({ mensaje: 'El tipo de usuario solicitado no es válido' })
    }

    let activo = null
    if (req.query.estado && req.query.estado !== 'todos') {
      if (!['activo', 'inactivo'].includes(req.query.estado)) {
        return res.status(400).json({ mensaje: 'El estado de cuenta solicitado no es válido' })
      }
      activo = req.query.estado === 'activo'
    }

    const busqueda = String(req.query.busqueda || '').trim()
    if (busqueda.length > 120) {
      return res.status(400).json({ mensaje: 'La búsqueda no puede superar los 120 caracteres' })
    }

    const pagina = Number.parseInt(req.query.pagina || '1', 10)
    const porPagina = Number.parseInt(req.query.porPagina || '20', 10)
    if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(porPagina) || porPagina < 1 || porPagina > LIMITE_MAXIMO) {
      return res.status(400).json({ mensaje: `La paginación debe ser válida y permitir hasta ${LIMITE_MAXIMO} resultados` })
    }

    const filtros = [rol, activo, busqueda || null]
    const where = `WHERE ($1::text IS NULL OR u.rol = $1)
                     AND ($2::boolean IS NULL OR u.activo = $2)
                     AND ($3::text IS NULL OR CONCAT_WS(' ', u.nombre, u.apellido, u.email, u.dni) ILIKE '%' || $3 || '%'
                       OR regexp_replace(COALESCE(u.dni, ''), '\\D', '', 'g')
                          ILIKE '%' || regexp_replace($3, '\\D', '', 'g') || '%')`
    const [conteo, usuarios] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM usuarios u ${where}`, filtros),
      query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.dni, u.rol, u.activo,
                u.email_verificado, u.creado_en,
                COALESCE(c.telefono, m.telefono) AS telefono,
                m.presentacion,
                v.estado AS estado_verificacion, v.iniciada_en AS verificacion_iniciada_en,
                v.enviada_en AS verificacion_enviada_en
         FROM usuarios u
         LEFT JOIN clientes c ON c.usuario_id = u.id
         LEFT JOIN comisionistas m ON m.usuario_id = u.id
         LEFT JOIN LATERAL (
           SELECT estado, iniciada_en, enviada_en
           FROM verificaciones_identidad
           WHERE usuario_id = u.id
           ORDER BY iniciada_en DESC, id DESC
           LIMIT 1
         ) v ON true
         ${where}
         ORDER BY u.creado_en DESC, u.id DESC
         LIMIT $4 OFFSET $5`,
        [...filtros, porPagina, (pagina - 1) * porPagina],
      ),
    ])
    const total = conteo.rows[0].total
    res.json({
      usuarios: usuarios.rows,
      pagina,
      porPagina,
      total,
      paginas: Math.ceil(total / porPagina),
    })
  } catch (error) { next(error) }
}

export async function actividad(req, res, next) {
  try {
    const [movimientos, decisiones] = await Promise.all([
      query(ACTIVIDAD_SQL, [ROLES_GESTIONABLES, 100]),
      query(
        `SELECT v.id, v.estado, v.motivo_resolucion, v.resuelta_en,
                u.id AS usuario_id, CONCAT_WS(' ', u.nombre, u.apellido) AS usuario,
                u.email AS usuario_email,
                admin.id AS administrador_id,
                CONCAT_WS(' ', admin.nombre, admin.apellido) AS administrador,
                admin.email AS administrador_email
         FROM verificaciones_identidad v
         JOIN usuarios u ON u.id = v.usuario_id
         LEFT JOIN usuarios admin ON admin.id = v.resuelta_por
         WHERE u.rol = 'comisionista' AND v.resuelta_en IS NOT NULL
           AND v.estado IN ('APROBADA_MANUALMENTE', 'RECHAZADA', 'REQUIERE_CORRECCION')
         ORDER BY v.resuelta_en DESC, v.id DESC
         LIMIT 100`,
      ),
    ])
    res.json({ actividad: movimientos.rows, decisiones: decisiones.rows })
  } catch (error) { next(error) }
}
