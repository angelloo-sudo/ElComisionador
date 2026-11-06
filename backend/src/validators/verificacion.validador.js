const CAMPOS_COINCIDENCIA = ['nombre', 'apellido', 'dni']
const CAMPOS_FACIALES = ['rostro_unico', 'parpadeo', 'giro', 'frente']

export function validarEnvioVerificacion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Los resultados de verificación no son válidos'
  const permitidos = new Set(['dni_parcial', 'resultado_ocr', 'coincidencias', 'controles_faciales'])
  if (Object.keys(body).some((campo) => !permitidos.has(campo))) return 'El envío contiene campos no permitidos'

  if (typeof body.dni_parcial !== 'string' || !/^[*•]{4,8}\d{4}$/.test(body.dni_parcial)) {
    return 'El DNI debe enviarse parcialmente oculto y mostrar solo los últimos cuatro dígitos'
  }
  if (!['legible', 'requiere_revision', 'no_legible'].includes(body.resultado_ocr)) {
    return 'El resultado OCR no es válido'
  }
  if (!body.coincidencias || typeof body.coincidencias !== 'object' || Array.isArray(body.coincidencias)
      || Object.keys(body.coincidencias).some((campo) => !CAMPOS_COINCIDENCIA.includes(campo))
      || CAMPOS_COINCIDENCIA.some((campo) => body.coincidencias[campo] !== null && typeof body.coincidencias[campo] !== 'boolean')) {
    return 'Las coincidencias deben indicar nombre, apellido y DNI como verdadero, falso o no disponible'
  }
  if (!body.controles_faciales || typeof body.controles_faciales !== 'object' || Array.isArray(body.controles_faciales)
      || Object.keys(body.controles_faciales).some((campo) => !CAMPOS_FACIALES.includes(campo))
      || CAMPOS_FACIALES.some((campo) => typeof body.controles_faciales[campo] !== 'boolean')) {
    return 'Los controles faciales deben contener resultados booleanos para rostro, parpadeo, giro y mirada al frente'
  }
  return null
}

export function validarResolucion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((campo) => !['decision', 'motivo'].includes(campo))) return 'La decisión no es válida'
  if (!['APROBADA_MANUALMENTE', 'RECHAZADA', 'REQUIERE_CORRECCION'].includes(body.decision)) {
    return 'La decisión administrativa no es válida'
  }
  if (body.decision === 'APROBADA_MANUALMENTE') {
    if (body.motivo !== undefined && (typeof body.motivo !== 'string' || body.motivo.trim().length > 500)) return 'El comentario no puede superar 500 caracteres'
  } else if (typeof body.motivo !== 'string' || body.motivo.trim().length < 3 || body.motivo.trim().length > 500) {
    return 'Indicá un motivo de entre 3 y 500 caracteres'
  }
  return null
}

export function validarIdVerificacion(id) {
  return /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0
}
