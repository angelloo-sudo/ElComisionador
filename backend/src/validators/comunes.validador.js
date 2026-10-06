// Validaciones compartidas entre el autorregistro (auth.controller.js) y el alta/edición
// de cuentas (y, a futuro, otros validadores). Evita tener el mismo
// regex de "nombre válido" duplicado y potencialmente desincronizado en dos archivos.

// Exige: inicial en mayúscula, solo letras (con acentos/ñ), y permite nombres
// compuestos separados por un solo espacio (ej: "María José"), cada palabra con
// su propia inicial en mayúscula.
export const REGEX_NOMBRE_PROPIO = /^[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ]*(?:\s[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ]*)*$/

const LONGITUD_MINIMA = 3
const LONGITUD_MAXIMA = 120

// Devuelve el mensaje de error si el valor no es válido, o null si está OK.
// obligatorio=false permite dejar el campo vacío (útil para "apellido", que no
// siempre se pide), pero si se completa igual debe cumplir el formato.
export function validarNombrePropio(valor, { obligatorio = true, etiqueta = 'El nombre' } = {}) {
  const limpio = typeof valor === 'string' ? valor.trim() : ''

  if (!limpio) {
    return obligatorio ? `${etiqueta} es obligatorio` : null
  }
  if (limpio.length < LONGITUD_MINIMA) {
    return `${etiqueta} debe tener al menos ${LONGITUD_MINIMA} caracteres`
  }
  if (limpio.length > LONGITUD_MAXIMA) {
    return `${etiqueta} no puede superar los ${LONGITUD_MAXIMA} caracteres`
  }
  if (!REGEX_NOMBRE_PROPIO.test(limpio)) {
    return `${etiqueta} debe empezar con mayúscula y contener solo letras (ej: "Facundo")`
  }
  return null
}

export function validarDni(valor, { obligatorio = true } = {}) {
  const limpio = typeof valor === 'string' ? valor.trim() : ''

  if (!limpio) {
    return obligatorio ? 'El DNI es obligatorio' : null
  }
  if (!/^\d{7,8}$/.test(limpio)) {
    return 'El DNI debe tener 7 u 8 dígitos'
  }
  return null
}

export function validarTelefono(valor, { obligatorio = true } = {}) {
  const limpio = typeof valor === 'string' ? valor.trim() : ''

  if (!limpio) {
    return obligatorio ? 'El teléfono es obligatorio' : null
  }
  if (!/^[0-9+\-\s()]{6,20}$/.test(limpio)) {
    return 'El teléfono tiene un formato inválido'
  }
  return null
}

const LONGITUD_MAXIMA_PRESENTACION = 500

// Presentacion del comisionista: texto libre y opcional, hasta 500 caracteres.
export function validarPresentacion(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  if (typeof valor !== 'string') return 'La presentación no es válida'
  if (valor.trim().length > LONGITUD_MAXIMA_PRESENTACION) {
    return `La presentación no puede superar los ${LONGITUD_MAXIMA_PRESENTACION} caracteres`
  }
  return null
}

// Foto de perfil: llega como data URL (el navegador ya la achico). Solo se aceptan
// jpeg/png/webp (nada de SVG, que puede llevar scripts) y se comprueba que el contenido
// empiece con la firma real del formato, no solo que el texto diga "image/jpeg".
const LONGITUD_MAXIMA_FOTO = 400_000 // caracteres base64, ~300 KB de imagen
const FIRMAS_FOTO = {
  'image/jpeg': '/9j/',
  'image/png': 'iVBORw0KGgo',
  'image/webp': 'UklGR',
}

export function validarFotoPerfil(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  if (typeof valor !== 'string') return 'La foto de perfil no es válida'

  const partes = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor)
  if (!partes) return 'La foto debe ser una imagen JPG, PNG o WebP'

  const [, tipo, contenido] = partes
  if (!contenido.startsWith(FIRMAS_FOTO[tipo])) return 'La foto de perfil no es una imagen válida'
  if (valor.length > LONGITUD_MAXIMA_FOTO) return 'La foto es demasiado pesada (máximo 300 KB)'
  return null
}
