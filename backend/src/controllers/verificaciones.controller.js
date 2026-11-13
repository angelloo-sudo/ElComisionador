import { query } from '../config/db.js'
import { compararDatosDocumentoPerfil, validarEnvioVerificacion, validarIdVerificacion, validarDatosDocumento, validarResolucion } from '../validators/verificacion.validador.js'

const ESTADOS_ACTIVOS = ['EN_PROCESO', 'PENDIENTE_REVISION']

export async function perfilRegistro(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, nombre, apellido, dni, rol FROM usuarios
       WHERE id = $1 AND activo = true AND email_verificado = true AND rol = ANY($2::text[])`,
      [req.usuario.id, ['cliente', 'comisionista']],
    )
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró una cuenta activa para verificar' })
    res.json(rows[0])
  } catch (error) { next(error) }
}

export async function estadoRegistro(req, res, next) {
  try {
    const cuenta = await query('SELECT email_verificado FROM usuarios WHERE id = $1 AND activo = true AND rol = ANY($2::text[])', [req.usuario.id, ['cliente', 'comisionista']])
    if (!cuenta.rows[0]) return res.status(404).json({ mensaje: 'No se encontr\u00f3 una cuenta activa para verificar' })
    if (!cuenta.rows[0].email_verificado) return res.status(403).json({ mensaje: 'Verific\u00e1 tu correo antes de iniciar la verificaci\u00f3n de identidad.' })
    const { rows } = await query(`SELECT id, estado FROM verificaciones_identidad WHERE usuario_id = $1 AND estado = ANY($2::text[]) ORDER BY iniciada_en DESC LIMIT 1`, [req.usuario.id, ESTADOS_ACTIVOS])
    res.json(rows[0] || null)
  } catch (error) { next(error) }
}
function parsearEstado(estado) {
  return ['NO_INICIADA', 'EN_PROCESO', 'PENDIENTE_REVISION', 'APROBADA_MANUALMENTE', 'RECHAZADA', 'REQUIERE_CORRECCION'].includes(estado)
    ? estado : null
}

export async function iniciar(req, res, next) {
  try {
    const cuenta = await query(`SELECT email_verificado FROM usuarios WHERE id = $1 AND rol = ANY($2::text[])`, [req.usuario.id, ['cliente', 'comisionista']])
    if (!cuenta.rows[0]?.email_verificado) return res.status(403).json({ mensaje: 'Verificá tu correo antes de iniciar la verificación de identidad.' })
    if (req.body?.consentimiento !== true || Object.keys(req.body ?? {}).some((campo) => campo !== 'consentimiento')) {
      return res.status(400).json({ mensaje: 'Se requiere consentimiento explícito para comenzar' })
    }
    const existente = await query(
      `SELECT id, estado, iniciada_en, actualizada_en FROM verificaciones_identidad
       WHERE usuario_id = $1 AND estado = ANY($2::text[]) ORDER BY iniciada_en DESC LIMIT 1`,
      [req.usuario.id, ESTADOS_ACTIVOS],
    )
    if (existente.rows[0]) return res.status(409).json({ mensaje: 'Ya existe una solicitud activa', solicitud: existente.rows[0] })

    const { rows } = await query(
      `INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en)
       VALUES ($1, 'EN_PROCESO', NOW())
       RETURNING id, estado, iniciada_en, actualizada_en`,
      [req.usuario.id],
    )
    res.status(201).json(rows[0])
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'verificaciones_identidad_activas_uq') {
      return res.status(409).json({ mensaje: 'Ya existe una solicitud activa' })
    }
    next(error)
  }
}

export async function validarDocumentoRegistro(req, res, next) {
  try {
    if (!validarIdVerificacion(req.params.id)) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
    const error = validarDatosDocumento(req.body)
    if (error) return res.status(400).json({ mensaje: error })
    const { rows: [perfil] } = await query(`SELECT nombre, apellido, dni FROM usuarios WHERE id = $1 AND activo = true AND email_verificado = true`, [req.usuario.id])
    if (!perfil) return res.status(403).json({ mensaje: 'La cuenta no está habilitada para verificar identidad.' })
    const resultado = compararDatosDocumentoPerfil(req.body, perfil)
    await query(`UPDATE verificaciones_identidad SET resultado_ocr = $3, dni_parcial = $4, coincidencias = $5::jsonb, actualizada_en = NOW()
      WHERE id = $1 AND usuario_id = $2 AND estado = 'EN_PROCESO'`, [req.params.id, req.usuario.id, resultado.completo ? 'legible' : 'requiere_revision', resultado.dni_parcial, JSON.stringify(resultado.coincidencias)])
    const actual = await query(`SELECT id FROM verificaciones_identidad WHERE id = $1 AND usuario_id = $2 AND estado = 'EN_PROCESO'`, [req.params.id, req.usuario.id])
    if (!actual.rows[0]) return res.status(404).json({ mensaje: 'No se encontró una solicitud en proceso de tu cuenta' })
    const coincide = resultado.completo && Object.values(resultado.coincidencias).every((v) => v === true)
    res.status(coincide ? 200 : 422).json({ resultado: !resultado.completo ? 'LECTURA_INCOMPLETA' : coincide ? 'LECTURA_CORRECTA_Y_COINCIDENTE' : 'DATOS_NO_COINCIDENTES', coincidencias: resultado.coincidencias, dni_parcial: resultado.dni_parcial })
  } catch (error) { next(error) }
}

export async function enviar(req, res, next) {
  try {
    if (!validarIdVerificacion(req.params.id)) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
    const errorValidacion = validarEnvioVerificacion(req.body)
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion })
    const { rows: [previa] } = await query(`SELECT resultado_ocr, coincidencias FROM verificaciones_identidad WHERE id = $1 AND usuario_id = $2 AND estado = 'EN_PROCESO'`, [req.params.id, req.usuario.id])
    if (!previa) return res.status(404).json({ mensaje: 'No se encontró una solicitud en proceso de tu cuenta' })
    if (previa.resultado_ocr !== 'legible' || !['nombre', 'apellido', 'dni'].every((c) => previa.coincidencias?.[c] === true)) return res.status(403).json({ mensaje: 'Los datos del PDF417 deben coincidir con el perfil antes de enviar la solicitud.' })
    const { rows } = await query(
      `UPDATE verificaciones_identidad SET estado = 'PENDIENTE_REVISION',
         enviada_en = NOW(), actualizada_en = NOW()
       WHERE id = $1 AND usuario_id = $2 AND estado = 'EN_PROCESO'
         AND resultado_ocr = 'legible'
         AND coincidencias->>'nombre' = 'true' AND coincidencias->>'apellido' = 'true' AND coincidencias->>'dni' = 'true'
       RETURNING id, estado, dni_parcial, resultado_ocr, coincidencias, enviada_en, actualizada_en`,
      [req.params.id, req.usuario.id],
    )
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró una solicitud en proceso de tu cuenta' })
    res.json(rows[0])
  } catch (error) { next(error) }
}

export async function listarMias(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, estado, dni_parcial, resultado_ocr, coincidencias,
              iniciada_en, actualizada_en, enviada_en, resuelta_en, motivo_resolucion
       FROM verificaciones_identidad WHERE usuario_id = $1 ORDER BY iniciada_en DESC`,
      [req.usuario.id],
    )
    res.json(rows)
  } catch (error) { next(error) }
}

export async function listarAdministrativas(req, res, next) {
  try {
    const estado = req.query.estado ? parsearEstado(req.query.estado) : null
    if (req.query.estado && !estado) return res.status(400).json({ mensaje: 'El estado solicitado no es válido' })
    const { rows } = await query(
      `SELECT v.id, v.usuario_id, u.rol, u.nombre, u.apellido, u.email,
              CASE WHEN u.dni IS NULL THEN NULL ELSE '••••' || RIGHT(regexp_replace(u.dni, '\\D', '', 'g'), 4) END AS dni_cuenta_parcial,
              v.estado, v.dni_parcial, v.resultado_ocr, v.coincidencias,
              v.iniciada_en, v.actualizada_en, v.enviada_en, v.resuelta_en,
              v.motivo_resolucion, v.resuelta_por
       FROM verificaciones_identidad v JOIN usuarios u ON u.id = v.usuario_id
       WHERE ($1::text IS NULL OR v.estado = $1)
       ORDER BY CASE WHEN v.estado = 'PENDIENTE_REVISION' THEN 0 ELSE 1 END, v.enviada_en DESC NULLS LAST, v.iniciada_en DESC`,
      [estado],
    )
    res.json(rows)
  } catch (error) { next(error) }
}

export async function detalleAdministrativo(req, res, next) {
  try {
    if (!validarIdVerificacion(req.params.id)) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
    const { rows } = await query(
      `SELECT v.id, v.usuario_id, u.rol, u.nombre, u.apellido, u.email,
              CASE WHEN u.dni IS NULL THEN NULL ELSE '••••' || RIGHT(regexp_replace(u.dni, '\\D', '', 'g'), 4) END AS dni_cuenta_parcial,
              v.estado, v.dni_parcial, v.resultado_ocr, v.coincidencias,
              v.iniciada_en, v.actualizada_en, v.enviada_en, v.resuelta_en,
              v.motivo_resolucion, v.resuelta_por
       FROM verificaciones_identidad v JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró la solicitud indicada' })
    res.json(rows[0])
  } catch (error) { next(error) }
}

export async function resolver(req, res, next) {
  try {
    if (!validarIdVerificacion(req.params.id)) return res.status(400).json({ mensaje: 'La solicitud indicada no es válida' })
    const errorValidacion = validarResolucion(req.body)
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion })
    const { decision, motivo } = req.body
    const { rows } = await query(
      `UPDATE verificaciones_identidad SET estado = $2, motivo_resolucion = $3,
         resuelta_por = $4, resuelta_en = NOW(), actualizada_en = NOW()
       WHERE id = $1 AND estado = 'PENDIENTE_REVISION' AND usuario_id <> $4
         AND ($2 <> 'APROBADA_MANUALMENTE' OR (
           resultado_ocr = 'legible'
           AND coincidencias->>'nombre' = 'true' AND coincidencias->>'apellido' = 'true' AND coincidencias->>'dni' = 'true'
         ))
       RETURNING id, estado, motivo_resolucion, resuelta_por, resuelta_en, actualizada_en`,
      [req.params.id, decision, motivo?.trim() || null, req.usuario.id],
    )
    if (!rows[0]) return res.status(404).json({ mensaje: 'No se encontró una solicitud pendiente para resolver' })
    res.json({ ...rows[0], alcance: 'La aprobación administrativa acepta la lectura y coincidencia declaradas por ComiTrack; no certifica la autenticidad del DNI ni constituye una validación oficial de identidad.' })
  } catch (error) { next(error) }
}
