const normalizar = (valor = '') => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function compararDatosDocumentoPerfil(documento, perfil) {
  const dni = String(documento?.dni ?? '').replace(/\D/g, '')
  const dniPerfil = String(perfil?.dni ?? '').replace(/\D/g, '')
  const coincidencias = {
    dni: /^\d{7,8}$/.test(dni) && dniPerfil ? dni === dniPerfil : null,
    nombre: normalizar(documento?.nombre) && normalizar(perfil?.nombre) ? normalizar(documento.nombre) === normalizar(perfil.nombre) : null,
    apellido: normalizar(documento?.apellido) && normalizar(perfil?.apellido) ? normalizar(documento.apellido) === normalizar(perfil.apellido) : null,
  }
  return { completo: Object.values(coincidencias).every((v) => v !== null), coincidencias, dni_parcial: /^\d{7,8}$/.test(dni) ? '••••' + dni.slice(-4) : null }
}

export function validarDatosDocumento(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !['dni', 'nombre', 'apellido'].includes(k))) return 'Los datos del documento no son válidos'
  if (typeof body.dni !== 'string' || typeof body.nombre !== 'string' || typeof body.apellido !== 'string' || body.dni.length > 20 || body.nombre.length > 120 || body.apellido.length > 120) return 'Los datos del documento no son válidos'
  return null
}

export function validarEnvioVerificacion(body) {
  return !body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length
    ? 'El envío no contiene los campos permitidos' : null
}

export function validarResolucion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((campo) => !['decision', 'motivo'].includes(campo))) return 'La decisión no es válida'
  if (!['APROBADA_MANUALMENTE', 'RECHAZADA', 'REQUIERE_CORRECCION'].includes(body.decision)) return 'La decisión administrativa no es válida'
  if (body.decision === 'APROBADA_MANUALMENTE') {
    if (body.motivo !== undefined && (typeof body.motivo !== 'string' || body.motivo.trim().length > 500)) return 'El comentario no puede superar 500 caracteres'
  } else if (typeof body.motivo !== 'string' || body.motivo.trim().length < 3 || body.motivo.trim().length > 500) return 'Indicá un motivo de entre 3 y 500 caracteres'
  return null
}

export function validarIdVerificacion(id) { return /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0 }
