// Epica 3: Gestion de Encomiendas (nucleo del sistema).
// Estados posibles: 'recibido' | 'en_viaje' | 'entregado' (US13).
import { query } from '../config/db.js'

const TIPOS_CONTENIDO = ['electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro']
const PESOS_KG = [0.5, 1, 2, 5, 10, 20]
const DIMENSIONES = ['0.5x0.5', '1x1', '2x2']

function validarDatosSolicitud(body = {}) {
  const {
    destinatario_nombre: nombre,
    destinatario_telefono: telefono,
    destinatario_direccion: direccion,
    direccion_retiro: direccionRetiro,
    tipo_contenido: tipoContenido,
    peso_kg: pesoKg,
    dimensiones,
    fragil,
    descripcion,
  } = body

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 120) {
    return { error: 'El nombre del destinatario es obligatorio y debe tener hasta 120 caracteres' }
  }
  if (typeof telefono !== 'string' || !telefono.trim() || telefono.trim().length > 40) {
    return { error: 'El teléfono del destinatario es obligatorio y debe tener hasta 40 caracteres' }
  }
  if (typeof direccion !== 'string' || !direccion.trim() || direccion.trim().length > 200) {
    return { error: 'La dirección del destinatario es obligatoria y debe tener hasta 200 caracteres' }
  }
  if (typeof direccionRetiro !== 'string' || !direccionRetiro.trim() || direccionRetiro.trim().length > 200) {
    return { error: 'La dirección de retiro es obligatoria y debe tener hasta 200 caracteres' }
  }
  if (!TIPOS_CONTENIDO.includes(tipoContenido)) {
    return { error: 'El tipo de contenido seleccionado no es válido' }
  }
  if (!PESOS_KG.includes(Number(pesoKg))) {
    return { error: 'El peso seleccionado no es válido' }
  }
  if (!DIMENSIONES.includes(dimensiones)) {
    return { error: 'Las dimensiones seleccionadas no son válidas' }
  }
  if (typeof fragil !== 'boolean') {
    return { error: 'Indicá si el contenido es frágil' }
  }
  if (tipoContenido === 'otro' && (typeof descripcion !== 'string' || !descripcion.trim() || descripcion.trim().length > 300)) {
    return { error: 'La aclaración de otro tipo de contenido es obligatoria y debe tener hasta 300 caracteres' }
  }
  if (descripcion != null && (typeof descripcion !== 'string' || descripcion.trim().length > 300)) {
    return { error: 'La aclaración debe tener hasta 300 caracteres' }
  }

  return {
    datos: {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      direccionRetiro: direccionRetiro.trim(),
      tipoContenido,
      pesoKg: Number(pesoKg),
      dimensiones,
      fragil,
      descripcion: descripcion?.trim() || null,
    },
  }
}

async function obtenerClienteId(usuarioId) {
  const { rows } = await query(
    `SELECT id FROM clientes WHERE usuario_id = $1`,
    [usuarioId],
  )
  return rows[0]?.id ?? null
}

async function obtenerDatosRemitente(usuarioId) {
  const { rows } = await query(
    `SELECT c.id, c.telefono, concat_ws(' ', u.nombre, u.apellido) AS nombre
     FROM clientes c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.usuario_id = $1 AND u.activo = true`,
    [usuarioId],
  )
  return rows[0] ?? null
}

export async function listar(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'listar encomiendas: pendiente' })
  } catch (e) { next(e) }
}

export async function listarMisSolicitudes(req, res, next) {
  try {
    const { rows: clientes } = await query(
      `SELECT id, primera_solicitud_encomienda_realizada
       FROM clientes
       WHERE usuario_id = $1`,
      [req.usuario.id],
    )

    if (clientes.length === 0) {
      return res.status(403).json({ mensaje: 'La cuenta no tiene una ficha de cliente activa' })
    }

    const { rows: solicitudes } = await query(
      `SELECT e.id, e.remitente_nombre, e.remitente_telefono, e.direccion_retiro,
              e.destinatario_nombre, e.destinatario_telefono, e.destinatario_direccion,
              e.tipo_contenido, e.peso_kg, e.dimensiones, e.fragil, e.descripcion,
              e.estado, e.estado_pago, e.fecha_solicitud, e.creado_en,
              COALESCE((
                SELECT json_agg(json_build_object('id', h.id, 'estado', h.estado, 'fecha_hora', h.fecha_hora)
                                ORDER BY h.fecha_hora, h.id)
                FROM historial_encomiendas h WHERE h.encomienda_id = e.id
              ), '[]'::json) AS historial
       FROM encomiendas
       e WHERE e.cliente_remitente_id = $1
       ORDER BY e.fecha_solicitud DESC, e.id DESC`,
      [clientes[0].id],
    )

    res.json({
      solicitudes,
      primera_solicitud_encomienda_realizada: clientes[0].primera_solicitud_encomienda_realizada,
    })
  } catch (e) { next(e) }
}

export async function listarPendientes(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT e.id, e.remitente_nombre, e.remitente_telefono, e.direccion_retiro,
              e.destinatario_nombre, e.destinatario_telefono, e.destinatario_direccion,
              e.tipo_contenido, e.peso_kg, e.dimensiones, e.fragil, e.descripcion,
              e.estado, e.fecha_solicitud,
              COALESCE((
                SELECT json_agg(json_build_object('id', h.id, 'estado', h.estado, 'fecha_hora', h.fecha_hora)
                                ORDER BY h.fecha_hora, h.id)
                FROM historial_encomiendas h WHERE h.encomienda_id = e.id
              ), '[]'::json) AS historial
       FROM encomiendas e
       WHERE e.estado = 'pendiente'
       ORDER BY e.fecha_solicitud, e.id`,
    )
    res.json({ solicitudes: rows })
  } catch (e) { next(e) }
}

export async function listarAceptadas(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT e.id, e.remitente_nombre, e.remitente_telefono, e.direccion_retiro,
              e.destinatario_nombre, e.destinatario_telefono, e.destinatario_direccion,
              e.tipo_contenido, e.peso_kg, e.dimensiones, e.fragil, e.descripcion,
              e.estado, e.estado_pago, e.fecha_solicitud,
              COALESCE((
                SELECT json_agg(json_build_object('id', h.id, 'estado', h.estado, 'fecha_hora', h.fecha_hora)
                                ORDER BY h.fecha_hora, h.id)
                FROM historial_encomiendas h WHERE h.encomienda_id = e.id
              ), '[]'::json) AS historial
       FROM encomiendas e
       WHERE e.estado IN ('aceptado', 'retirado')
       ORDER BY e.fecha_solicitud DESC, e.id DESC`,
    )
    res.json({ solicitudes: rows })
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    res.status(501).json({ mensaje: `obtener encomienda ${req.params.id}: pendiente` })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { datos, error } = validarDatosSolicitud(req.body)
    if (error) {
      return res.status(400).json({ mensaje: error })
    }

    const remitente = await obtenerDatosRemitente(req.usuario.id)
    if (!remitente) {
      return res.status(403).json({ mensaje: 'La cuenta no tiene una ficha de cliente activa' })
    }

    const { rows } = await query(
      `WITH nueva AS (
         INSERT INTO encomiendas (
           cliente_remitente_id, remitente_nombre, remitente_telefono, direccion_retiro,
           destinatario_nombre, destinatario_telefono, destinatario_direccion,
           tipo_contenido, peso_kg, dimensiones, fragil, descripcion
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, cliente_remitente_id, remitente_nombre, remitente_telefono,
                   direccion_retiro, destinatario_nombre, destinatario_telefono,
                   destinatario_direccion, tipo_contenido, peso_kg, dimensiones,
                   fragil, descripcion, estado, estado_pago, fecha_solicitud, creado_en
       ), actualizado AS (
         UPDATE clientes
         SET primera_solicitud_encomienda_realizada = true
         WHERE id = $1
         RETURNING id
       )
       SELECT nueva.* FROM nueva
       JOIN actualizado ON actualizado.id = nueva.cliente_remitente_id`,
      [
        remitente.id,
        remitente.nombre,
        remitente.telefono,
        datos.direccionRetiro,
        datos.nombre,
        datos.telefono,
        datos.direccion,
        datos.tipoContenido,
        datos.pesoKg,
        datos.dimensiones,
        datos.fragil,
        datos.descripcion,
      ],
    )

    res.status(201).json({ encomienda: rows[0], mensaje: 'Solicitud de envío registrada correctamente' })
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    const { datos, error } = validarDatosSolicitud(req.body)
    if (error) {
      return res.status(400).json({ mensaje: error })
    }

    const clienteId = await obtenerClienteId(req.usuario.id)
    if (!clienteId) {
      return res.status(403).json({ mensaje: 'La cuenta no tiene una ficha de cliente activa' })
    }

    const { rows } = await query(
      `UPDATE encomiendas
       SET direccion_retiro = $1, destinatario_nombre = $2, destinatario_telefono = $3,
           destinatario_direccion = $4, tipo_contenido = $5, peso_kg = $6,
           dimensiones = $7, fragil = $8, descripcion = $9
       WHERE id = $10 AND cliente_remitente_id = $11 AND estado = 'pendiente'
       RETURNING id, remitente_nombre, remitente_telefono, direccion_retiro,
                 destinatario_nombre, destinatario_telefono, destinatario_direccion,
                 tipo_contenido, peso_kg, dimensiones, fragil, descripcion,
                 estado, estado_pago, fecha_solicitud, creado_en`,
      [
        datos.direccionRetiro,
        datos.nombre,
        datos.telefono,
        datos.direccion,
        datos.tipoContenido,
        datos.pesoKg,
        datos.dimensiones,
        datos.fragil,
        datos.descripcion,
        req.params.id,
        clienteId,
      ],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró una solicitud pendiente que puedas modificar' })
    }

    res.json({ encomienda: rows[0], mensaje: 'Solicitud de envío actualizada correctamente' })
  } catch (e) { next(e) }
}

export async function cambiarEstado(req, res, next) {
  try {
    const { estado } = req.body
    if (!['aceptado', 'retirado'].includes(estado)) {
      return res.status(400).json({ mensaje: 'El estado debe ser Aceptado o Retirado' })
    }

    const { rows } = await query(
      `UPDATE encomiendas
       SET estado = $2, estado_pago = COALESCE(estado_pago, 'pendiente')
       WHERE id = $1 AND estado IN ('aceptado', 'retirado')
       RETURNING id, estado, estado_pago`,
      [req.params.id, estado],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró una encomienda aceptada o retirada' })
    }

    res.json({ encomienda: rows[0], mensaje: 'Estado de la encomienda actualizado correctamente' })
  } catch (e) { next(e) }
}

export async function aceptar(req, res, next) {
  try {
    const { rows } = await query(
      `UPDATE encomiendas
       SET estado = 'aceptado', estado_pago = 'pendiente'
       WHERE id = $1 AND estado = 'pendiente'
       RETURNING id, estado, estado_pago`,
      [req.params.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'La solicitud no existe o ya fue revisada' })
    }

    res.json({ encomienda: rows[0], mensaje: 'Solicitud aceptada. El pago queda pendiente.' })
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    const clienteId = await obtenerClienteId(req.usuario.id)
    if (!clienteId) {
      return res.status(403).json({ mensaje: 'La cuenta no tiene una ficha de cliente activa' })
    }

    const { rowCount } = await query(
      `DELETE FROM encomiendas WHERE id = $1 AND cliente_remitente_id = $2`,
      [req.params.id, clienteId],
    )
    if (rowCount === 0) {
      return res.status(404).json({ mensaje: 'No se encontró la solicitud de envío' })
    }

    res.json({ mensaje: 'Solicitud de envío eliminada correctamente' })
  } catch (e) { next(e) }
}
