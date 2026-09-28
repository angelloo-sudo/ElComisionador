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
