// Epica 7 - Formato y validaciones de gastos y tipos de gasto (espejo de las del backend).
import { hoyEnCordoba } from './estadoViaje.js'

const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

// El backend manda los montos como texto ("1500.00") para no perder precision.
export function formatoMoneda(valor) {
  return formatoPesos.format(Number(valor))
}

// "2026-10-17" -> "17/10/2026" (sin pasar por Date, que corre el dia por la zona horaria).
export function formatoFechaISO(fecha) {
  if (!fecha) return '-'
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

export function formatoFechaHora(valor) {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function esFechaReal(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

// Devuelve { campo: 'mensaje' } con los errores; vacio si el formulario es valido.
export function validarFormGasto(form) {
  const errores = {}
  if (!form.tipo_gasto_id) errores.tipo_gasto_id = 'Elegí el tipo de gasto (concepto)'

  const monto = String(form.monto).trim()
  if (!monto) errores.monto = 'El monto es obligatorio'
  else if (!/^\d+(\.\d{1,2})?$/.test(monto)) errores.monto = 'Ingresá un monto positivo con hasta 2 decimales'
  else if (Number(monto) <= 0) errores.monto = 'El monto debe ser mayor a cero'
  else if (Number(monto) > 9_999_999_999.99) errores.monto = 'El monto es demasiado grande'

  if (!form.fecha) errores.fecha = 'La fecha es obligatoria'
  else if (!esFechaReal(form.fecha)) errores.fecha = 'La fecha no es válida'
  else if (form.fecha > hoyEnCordoba()) errores.fecha = 'La fecha del gasto no puede ser posterior a hoy'
  else if (form.fecha < '2000-01-01') errores.fecha = 'La fecha del gasto es demasiado antigua'

  if (form.descripcion.trim().length > 500) errores.descripcion = 'La descripción no puede superar los 500 caracteres'
  return errores
}

export function validarFormTipo(form) {
  const errores = {}
  const nombre = form.nombre.trim().replace(/\s+/g, ' ')
  if (!nombre) errores.nombre = 'El nombre es obligatorio'
  else if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres'
  else if (nombre.length > 60) errores.nombre = 'El nombre no puede superar los 60 caracteres'
  else if (!/^[\p{L}\p{N}][\p{L}\p{N} .,&()/'-]*$/u.test(nombre)) {
    errores.nombre = 'Solo letras, números, espacios y los signos . , & ( ) / \' -'
  }
  if (form.descripcion.trim().length > 200) errores.descripcion = 'La descripción no puede superar los 200 caracteres'
  return errores
}
