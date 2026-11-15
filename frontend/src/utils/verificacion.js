const normalizar = (valor) => String(valor ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-AR').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()

function variantesNombre(valor) {
  const original = String(valor ?? '')
  const variantes = [normalizar(original)]
  if (/ñ/i.test(original)) variantes.push(normalizar(original.replace(/ñ/gi, 'xx')))
  return [...new Set(variantes)]
}

function nombresEquivalentes(a, b) {
  const variantesA = variantesNombre(a)
  const variantesB = variantesNombre(b)
  return variantesA.some((variante) => variantesB.includes(variante))
}

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

export async function detectarTipoImagenDni(archivo) {
  const cabecera = new Uint8Array(await archivo.slice(0, 12).arrayBuffer())
  if (cabecera[0] === 0xff && cabecera[1] === 0xd8 && cabecera[2] === 0xff) return 'image/jpeg'
  if (cabecera.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, indice) => cabecera[indice] === byte)) return 'image/png'
  if (cabecera.length >= 12 &&
    String.fromCharCode(...cabecera.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...cabecera.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

export function esErrorPDF417SinCodigo(error) {
  const erroresSinCodigo = ['NotFoundException', 'ChecksumException', 'FormatException', 'ReaderException']
  const tipo = typeof error?.getKind === 'function' ? error.getKind() : null
  return erroresSinCodigo.includes(tipo) || erroresSinCodigo.includes(error?.name)
}

export function consolidarLecturasPDF417(textos = []) {
  const lecturas = textos.map(extraerDatosPDF417).filter(Boolean)
  if (lecturas.length === 0) return { estado: 'SIN_LECTURA', datos: null }

  const [primera, ...restantes] = lecturas
  const coinciden = restantes.every((lectura) =>
    lectura.dni === primera.dni &&
    nombresEquivalentes(lectura.nombre, primera.nombre) &&
    nombresEquivalentes(lectura.apellido, primera.apellido),
  )
  return coinciden
    ? { estado: 'OK', datos: primera }
    : { estado: 'INCONSISTENTE', datos: null }
}

// El DNI trae todos los nombres y la cuenta puede tener solo uno: coincide si todas las
// palabras del perfil aparecen en el documento (mismo criterio que el backend).
export function compararPerfil(datos, perfil) {
  const comparar = (extraido, registrado) => {
    const variantesDoc = variantesNombre(extraido)
    const variantesPerfil = variantesNombre(registrado)
    if (variantesDoc.every((variante) => !variante) || variantesPerfil.every((variante) => !variante)) return null
    return variantesDoc.some((doc) =>
      variantesPerfil.some((per) => doc === per || per.split(' ').every((palabra) => new Set(doc.split(' ')).has(palabra))),
    )
  }
  const dniExtraido = String(datos?.dni || '').replace(/\D/g, '')
  const dniPerfil = String(perfil?.dni || '').replace(/\D/g, '')
  return { nombre: comparar(datos?.nombre, perfil?.nombre), apellido: comparar(datos?.apellido, perfil?.apellido), dni: /^\d{7,8}$/.test(dniExtraido) && dniPerfil ? dniExtraido === dniPerfil : null }
}

export function formatearEstadoVerificacion(estado) {
  return ({ NO_INICIADA: 'Todavía no comenzaste', EN_PROCESO: 'En proceso', PENDIENTE_REVISION: 'Pendiente de revisión', APROBADA_MANUALMENTE: 'Aceptada por administración', RECHAZADA: 'Rechazada', REQUIERE_CORRECCION: 'Requiere corrección' })[estado] || estado || 'Sin estado'
}
