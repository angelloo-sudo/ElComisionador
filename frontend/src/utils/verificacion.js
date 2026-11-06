const sinAcentos = (valor = '') => String(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function fechaEnLinea(linea) {
  const m = linea.match(/\b([0-3]?\d)[./\s-]([01]?\d)[./\s-](\d{4})\b/)
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : ''
}

function campoConEtiqueta(lineas, etiqueta) {
  for (let i = 0; i < lineas.length; i += 1) {
    const m = lineas[i].match(new RegExp(`^${etiqueta}\\s*[:.]?\\s*(.*)$`))
    if (!m) continue
    if (m[1]) return m[1].replace(/\b(ARGENTINA|REPUBLICA|ARGENTINA|SEXO|DNI)\b/g, '').trim()
    return lineas[i + 1] || ''
  }
  return ''
}

export function extraerDatosDni(textos) {
  const texto = Array.isArray(textos) ? textos.join('\n') : String(textos ?? '')
  const lineas = texto.split(/\r?\n/).map((l) => sinAcentos(l)).filter(Boolean)
  let dni = ''

  // Preferir el número junto a la etiqueta DNI. Se excluyen fechas y número de trámite.
  for (let i = 0; i < lineas.length && !dni; i += 1) {
    if (!/\bDNI\b/.test(lineas[i])) continue
    const contexto = `${lineas[i]} ${lineas[i + 1] || ''}`
    const digitos = contexto.match(/\d[\d. ]{5,14}\d/g) || []
    dni = digitos.map((v) => v.replace(/\D/g, '')).find((v) => /^\d{7,8}$/.test(v)) || ''
  }
  if (!dni) {
    for (const linea of lineas) {
      if (/\b(FECHA|NACIMIENTO|VENCIMIENTO|TRAMITE|EJEMPLAR)\b/.test(linea)) continue
      const candidatos = linea.match(/\d[\d. ]{5,14}\d/g) || []
      dni = candidatos.map((v) => v.replace(/\D/g, '')).find((v) => /^\d{7,8}$/.test(v)) || ''
      if (dni) break
    }
  }

  const apellido = campoConEtiqueta(lineas, 'APELLIDO(?:S)?')
  const nombre = campoConEtiqueta(lineas, 'NOMBRE(?:S)?')
  const nacimiento = lineas.find((l) => /\bNACIMIENTO\b/.test(l)) || ''
  const vencimiento = lineas.find((l) => /\b(VENCIMIENTO|VENCE)\b/.test(l)) || ''
  const tramiteLinea = lineas.find((l) => /\bTRAMITE\b/.test(l)) || ''
  const tramite = (tramiteLinea.match(/\d{9,12}/) || [])[0] || ''

  return {
    dni,
    nombre: nombre.slice(0, 120),
    apellido: apellido.slice(0, 120),
    fecha_nacimiento: fechaEnLinea(nacimiento),
    fecha_vencimiento: fechaEnLinea(vencimiento),
    numero_tramite: tramite,
    resultado_ocr: texto.replace(/\s/g, '').length < 12
      ? 'no_legible'
      : (dni && nombre && apellido ? 'legible' : 'requiere_revision'),
  }
}

export function compararPerfil(datos, perfil) {
  const comparar = (extraido, registrado) => {
    if (!extraido || !registrado) return null
    return sinAcentos(extraido) === sinAcentos(registrado)
  }
  const dniExtraido = String(datos?.dni || '').replace(/\D/g, '')
  const dniPerfil = String(perfil?.dni || '').replace(/\D/g, '')
  return {
    nombre: comparar(datos?.nombre, perfil?.nombre),
    apellido: comparar(datos?.apellido, perfil?.apellido),
    dni: dniExtraido && dniPerfil ? dniExtraido === dniPerfil : null,
  }
}

export function enmascararDni(dni) {
  const digitos = String(dni || '').replace(/\D/g, '')
  return /^\d{7,8}$/.test(digitos) ? `••••${digitos.slice(-4)}` : ''
}

export function formatearEstadoVerificacion(estado) {
  return ({
    NO_INICIADA: 'Todavía no comenzaste',
    EN_PROCESO: 'En proceso',
    PENDIENTE_REVISION: 'Pendiente de revisión',
    APROBADA_MANUALMENTE: 'Controles preliminares aceptados',
    RECHAZADA: 'Rechazada',
    REQUIERE_CORRECCION: 'Requiere corrección',
  })[estado] || estado || 'Sin estado'
}
