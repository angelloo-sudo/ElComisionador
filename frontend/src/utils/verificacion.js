const normalizar = (valor = '') => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function campoNombre(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
}

// Formatos observados en DNI tarjeta argentinos: el vigente (PDF417 en el
// frente) y el anterior (PDF417 en el dorso). No se intenta adivinar otros.
export function extraerDatosPDF417(texto) {
  const partes = String(texto ?? '').replace(/[\r\n\0]/g, '').split('@')
  while (partes.length && partes.at(-1) === '') partes.pop()
  let apellido = ''
  let nombre = ''
  let dni = ''

  if (partes.length === 8 || partes.length === 9) {
    apellido = partes[1]
    nombre = partes[2]
    dni = partes[4]
  } else if (partes.length === 16 || partes.length === 17) {
    dni = partes[1]
    apellido = partes[4]
    nombre = partes[5]
  } else {
    return null
  }

  dni = String(dni ?? '').replace(/\D/g, '')
  apellido = campoNombre(apellido)
  nombre = campoNombre(nombre)
  if (!/^\d{7,8}$/.test(dni) || !nombre || !apellido) return null
  return { dni, nombre, apellido }
}

export function compararPerfil(datos, perfil) {
  const comparar = (extraido, registrado) => extraido && registrado ? normalizar(extraido) === normalizar(registrado) : null
  const dniExtraido = String(datos?.dni || '').replace(/\D/g, '')
  const dniPerfil = String(perfil?.dni || '').replace(/\D/g, '')
  return { nombre: comparar(datos?.nombre, perfil?.nombre), apellido: comparar(datos?.apellido, perfil?.apellido), dni: /^\d{7,8}$/.test(dniExtraido) && dniPerfil ? dniExtraido === dniPerfil : null }
}

export function enmascararDni(dni) {
  const digitos = String(dni || '').replace(/\D/g, '')
  return /^\d{7,8}$/.test(digitos) ? `••••${digitos.slice(-4)}` : ''
}

export function formatearEstadoVerificacion(estado) {
  return ({ NO_INICIADA: 'Todavía no comenzaste', EN_PROCESO: 'En proceso', PENDIENTE_REVISION: 'Pendiente de revisión', APROBADA_MANUALMENTE: 'Aceptada por administración', RECHAZADA: 'Rechazada', REQUIERE_CORRECCION: 'Requiere corrección' })[estado] || estado || 'Sin estado'
}
