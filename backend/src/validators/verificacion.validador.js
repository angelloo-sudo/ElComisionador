const normalizar = (valor) => String(valor ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-AR').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()

function variantesNombre(valor) {
  const original = String(valor ?? '')
  const variantes = [normalizar(original)]
  if (/ñ/i.test(original)) variantes.push(normalizar(original.replace(/ñ/gi, 'xx')))
  return [...new Set(variantes)]
}

// El DNI trae todos los nombres ("JUAN CARLOS") y muchas personas se registran solo con
// uno ("Juan"). Coincide si todas las palabras cargadas en el perfil aparecen en el documento.
export function nombresCoinciden(documento, perfil) {
  const variantesDoc = variantesNombre(documento)
  const variantesPerfil = variantesNombre(perfil)
  if (variantesDoc.every((variante) => !variante) || variantesPerfil.every((variante) => !variante)) return null
  return variantesDoc.some((doc) =>
    variantesPerfil.some((per) => doc === per || per.split(' ').every((palabra) => new Set(doc.split(' ')).has(palabra))),
  )
}

export function compararDatosDocumentoPerfil(documento, perfil) {
  const dni = String(documento?.dni ?? '').replace(/\D/g, '')
  const dniPerfil = String(perfil?.dni ?? '').replace(/\D/g, '')
  const coincidencias = {
    dni: /^\d{7,8}$/.test(dni) && dniPerfil ? dni === dniPerfil : null,
    nombre: nombresCoinciden(documento?.nombre, perfil?.nombre),
    apellido: nombresCoinciden(documento?.apellido, perfil?.apellido),
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
