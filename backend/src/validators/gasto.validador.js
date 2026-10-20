// Epica 7 - Validaciones de gastos (US40, US41, US44) y de tipos de gasto (US45, US46).
// Cada validador es una funcion pura (normaliza + valida) y un middleware que la usa:
// responde 400 con { errores: [...] } y, si todo esta bien, deja los datos limpios en req.datos.
import { hoyEnCordoba } from '../services/estado-viaje.js'

const DESCRIPCION_GASTO_MAX = 500
const MONTO_MAXIMO = 9_999_999_999.99 // NUMERIC(12,2)
const FECHA_MINIMA = '2000-01-01'

const TIPO_NOMBRE_MIN = 3
const TIPO_NOMBRE_MAX = 60
const TIPO_DESCRIPCION_MAX = 200
// Empieza con letra o numero y admite espacios y signos comunes (ej: "Seguro (auto)", "Peajes y tasas").
const REGEX_NOMBRE_TIPO = /^[\p{L}\p{N}][\p{L}\p{N} .,&()/'-]*$/u

const ID_MAXIMO = 2_147_483_647 // INTEGER de PostgreSQL

// ---------- Helpers reutilizables por los controladores ----------

// Devuelve el id como numero si es un entero positivo valido para PostgreSQL; si no, null.
export function parsearId(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const texto = String(valor).trim()
  if (!/^\d+$/.test(texto)) return null
  const numero = Number(texto)
  return Number.isSafeInteger(numero) && numero >= 1 && numero <= ID_MAXIMO ? numero : null
}

// true si "YYYY-MM-DD" es una fecha real del calendario (rechaza 2026-02-31, que Date.parse acepta).
export function esFechaISOValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

function textoLimpio(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : ''
}

// Descripcion opcional: vacia -> null. Devuelve { valor, error }.
function descripcionOpcional(valor, maximo, etiqueta = 'La descripción') {
  if (valor === undefined || valor === null || valor === '') return { valor: null }
  if (typeof valor !== 'string') return { error: `${etiqueta} no es válida` }
  const limpia = valor.trim()
  if (limpia.length > maximo) return { error: `${etiqueta} no puede superar los ${maximo} caracteres` }
  return { valor: limpia || null }
}

// Monto: numero o texto con punto decimal y hasta 2 decimales ("1500", "1500.5", 1500.50).
// Devuelve { valor: '1500.50' (texto, para no perder precision), error }.
export function validarMonto(valor) {
  if (valor === undefined || valor === null || valor === '') return { error: 'El monto es obligatorio' }
  if (typeof valor !== 'number' && typeof valor !== 'string') return { error: 'El monto no es válido' }

  const texto = String(valor).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    return { error: 'El monto debe ser un número positivo con hasta 2 decimales' }
  }
  const numero = Number(texto)
  if (numero <= 0) return { error: 'El monto debe ser mayor a cero' }
  if (numero > MONTO_MAXIMO) return { error: 'El monto es demasiado grande' }
  return { valor: numero.toFixed(2) }
}

// ---------- Gasto ----------
// El "concepto" del gasto es su tipo de gasto, por eso tipo_gasto_id es obligatorio.
// hoy: fecha "YYYY-MM-DD" de referencia (se inyecta para poder probarlo).
export function normalizarGasto(body = {}, { hoy = hoyEnCordoba() } = {}) {
  const errores = []
  const datos = {}

  const tipo = validarTipoGastoId(body.tipo_gasto_id)
  if (tipo.error) errores.push(tipo.error)
  else if (tipo.valor === undefined || tipo.valor === null) errores.push('Elegí el tipo de gasto (concepto)')
  else datos.tipo_gasto_id = tipo.valor

  const monto = validarMonto(body.monto)
  if (monto.error) errores.push(monto.error)
  else datos.monto = monto.valor

  if (!body.fecha) {
    errores.push('La fecha es obligatoria')
  } else if (!esFechaISOValida(body.fecha)) {
    errores.push('La fecha tiene un formato inválido (usá AAAA-MM-DD)')
  } else if (body.fecha > hoy) {
    errores.push('La fecha del gasto no puede ser posterior a hoy')
  } else if (body.fecha < FECHA_MINIMA) {
    errores.push('La fecha del gasto es demasiado antigua')
  } else {
    datos.fecha = body.fecha
  }

  const descripcion = descripcionOpcional(body.descripcion, DESCRIPCION_GASTO_MAX)
  if (descripcion.error) errores.push(descripcion.error)
  else datos.descripcion = descripcion.valor

  return { errores, datos }
}

// undefined -> { valor: undefined } (no informado); null / '' -> { valor: null }; id valido -> { valor: id }.
export function validarTipoGastoId(valor) {
  if (valor === undefined) return { valor: undefined }
  if (valor === null || valor === '') return { valor: null }
  const id = parsearId(valor)
  if (id === null) return { error: 'El tipo de gasto elegido no es válido' }
  return { valor: id }
}

export function validarGasto(req, res, next) {
  const { errores, datos } = normalizarGasto(req.body)
  if (errores.length > 0) return res.status(400).json({ errores })
  req.datos = datos
  next()
}

// ---------- Tipo de gasto ----------

export function normalizarTipoGasto(body = {}) {
  const errores = []
  const datos = {}

  const nombre = textoLimpio(body.nombre)
  if (!nombre) {
    errores.push('El nombre es obligatorio')
  } else if (nombre.length < TIPO_NOMBRE_MIN) {
    errores.push(`El nombre debe tener al menos ${TIPO_NOMBRE_MIN} caracteres`)
  } else if (nombre.length > TIPO_NOMBRE_MAX) {
    errores.push(`El nombre no puede superar los ${TIPO_NOMBRE_MAX} caracteres`)
  } else if (!REGEX_NOMBRE_TIPO.test(nombre)) {
    errores.push('El nombre solo puede tener letras, números, espacios y los signos . , & ( ) / \' -')
  } else {
    datos.nombre = nombre
  }

  const descripcion = descripcionOpcional(body.descripcion, TIPO_DESCRIPCION_MAX)
  if (descripcion.error) errores.push(descripcion.error)
  else datos.descripcion = descripcion.valor

  return { errores, datos }
}

export function validarTipoGasto(req, res, next) {
  const { errores, datos } = normalizarTipoGasto(req.body)
  if (errores.length > 0) return res.status(400).json({ errores })
  req.datos = datos
  next()
}
