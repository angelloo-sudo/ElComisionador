// US19 - Validacion del formulario con el que un cliente solicita un viaje
// (como pasajero o para enviar una encomienda).
import { validarNombrePropio, validarDni, validarTelefono } from './comunes.validador.js'
import { esLocalidadValida } from '../services/localidades.service.js'

export const TIPOS_SOLICITUD = ['pasajero', 'encomienda']
export const TIPOS_CONTENIDO = ['electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro']
export const FORMAS_PAGO = ['efectivo', 'transferencia']
export const MAX_PASAJEROS_POR_SOLICITUD = 20

// Codigo postal argentino: 4 digitos (5000) o CPA de 8 caracteres (X5000ABC).
export const normalizarCodigoPostal = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '').toUpperCase() : '')
const CODIGO_POSTAL = /^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/

const texto = (v) => (typeof v === 'string' ? v.trim() : '')

function validarUbicacion(d, prefijo, etiqueta, errores) {
  const calle = texto(d[`${prefijo}_calle`])
  const altura = texto(d[`${prefijo}_altura`])
  const codigoPostal = normalizarCodigoPostal(d[`${prefijo}_codigo_postal`])
  if (calle.length < 2 || calle.length > 100) errores.push(`La calle de ${etiqueta} es obligatoria (hasta 100 caracteres)`)
  if (!/^\d{1,6}$/.test(altura)) errores.push(`La altura de ${etiqueta} debe ser un número (hasta 6 dígitos)`)
  if (!CODIGO_POSTAL.test(codigoPostal)) errores.push(`El código postal de ${etiqueta} es obligatorio (4 dígitos, por ejemplo 5000)`)
}

function numeroPositivo(valor, max) {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 && n <= max ? n : null
}

// Devuelve { errores: [...], datos: {...columnas listas para insertar} }.
export function validarSolicitud(body = {}) {
  const errores = []
  const tipo = body.tipo
  if (!TIPOS_SOLICITUD.includes(tipo)) {
    return { errores: ['Elegí si querés viajar como pasajero o enviar una encomienda'], datos: null }
  }

  const agregar = (e) => { if (e) errores.push(e) }
  const datos = { tipo }

  validarUbicacion(body, 'origen', 'origen (donde te buscan)', errores)
  validarUbicacion(body, 'destino', 'destino', errores)
  datos.origen_calle = texto(body.origen_calle)
  datos.origen_altura = texto(body.origen_altura)
  datos.origen_codigo_postal = normalizarCodigoPostal(body.origen_codigo_postal)
  datos.origen_descripcion = texto(body.origen_descripcion) || null
  if (datos.origen_descripcion && datos.origen_descripcion.length > 300) errores.push('La descripción del lugar no puede superar los 300 caracteres')
  datos.destino_calle = texto(body.destino_calle)
  datos.destino_altura = texto(body.destino_altura)
  datos.destino_codigo_postal = normalizarCodigoPostal(body.destino_codigo_postal)

  // Localidad donde sube / baja (o donde se retira / entrega el paquete). Si no viene, se usa la del viaje.
  for (const [prefijo, etiqueta] of [['origen', 'de subida o retiro'], ['destino', 'de bajada o entrega']]) {
    const loc = texto(body[`${prefijo}_localidad`])
    if (loc && esLocalidadValida(loc) === false) errores.push(`La localidad ${etiqueta} debe ser una de la lista de Córdoba`)
    datos[`${prefijo}_localidad`] = loc || null
  }

  if (tipo === 'pasajero') {
    agregar(validarNombrePropio(body.nombre, { etiqueta: 'El nombre' }))
    agregar(validarNombrePropio(body.apellido, { etiqueta: 'El apellido' }))
    agregar(validarDni(body.dni))
    agregar(validarTelefono(body.telefono))
    Object.assign(datos, { nombre: texto(body.nombre), apellido: texto(body.apellido), dni: texto(body.dni), telefono: texto(body.telefono) })

    if (typeof body.lleva_equipaje !== 'boolean') {
      errores.push('Indicá si llevás equipaje')
    } else {
      datos.lleva_equipaje = body.lleva_equipaje
      const detalle = texto(body.equipaje_detalle)
      if (body.lleva_equipaje) {
        if (detalle.length < 3) errores.push('Especificá qué equipaje llevás')
        else if (detalle.length > 300) errores.push('El detalle del equipaje no puede superar los 300 caracteres')
      }
      datos.equipaje_detalle = body.lleva_equipaje ? detalle : null
    }

    const cantidad = Number(body.cantidad_pasajeros)
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_PASAJEROS_POR_SOLICITUD) {
      errores.push(`La cantidad de pasajeros debe ser un número entre 1 y ${MAX_PASAJEROS_POR_SOLICITUD}`)
    }
    datos.cantidad_pasajeros = cantidad

  } else {
    const peso = numeroPositivo(body.peso_kg, 1000)
    const ancho = numeroPositivo(body.ancho_cm, 1000)
    const largo = numeroPositivo(body.largo_cm, 1000)
    if (peso === null) errores.push('El peso del paquete debe ser mayor a 0 y hasta 1000 kg')
    if (ancho === null) errores.push('El ancho del paquete debe ser mayor a 0 y hasta 1000 cm')
    if (largo === null) errores.push('El largo del paquete debe ser mayor a 0 y hasta 1000 cm')
    Object.assign(datos, { peso_kg: peso, ancho_cm: ancho, largo_cm: largo })

    if (typeof body.fragil !== 'boolean') errores.push('Indicá si el paquete es frágil')
    datos.fragil = body.fragil
    if (!TIPOS_CONTENIDO.includes(body.tipo_contenido)) errores.push('Elegí el tipo de contenido del paquete')
    datos.tipo_contenido = body.tipo_contenido
    if (body.tipo_contenido === 'otro') {
      const d = texto(body.contenido_descripcion)
      if (!d || d.length < 3) errores.push('Aclará qué contiene el paquete (mínimo 3 caracteres)')
      else if (d.length > 300) errores.push('La aclaración del contenido admite hasta 300 caracteres')
      datos.contenido_descripcion = d
    } else {
      datos.contenido_descripcion = null
    }

    for (const [prefijo, etiqueta] of [['emisor', 'del emisor'], ['receptor', 'del receptor']]) {
      agregar(validarNombrePropio(body[`${prefijo}_nombre`], { etiqueta: `El nombre ${etiqueta}` }))
      agregar(validarNombrePropio(body[`${prefijo}_apellido`], { etiqueta: `El apellido ${etiqueta}` }))
      agregar(validarTelefono(body[`${prefijo}_telefono`]))
      datos[`${prefijo}_nombre`] = texto(body[`${prefijo}_nombre`])
      datos[`${prefijo}_apellido`] = texto(body[`${prefijo}_apellido`])
      datos[`${prefijo}_telefono`] = texto(body[`${prefijo}_telefono`])
    }
  }

  // Forma de pago: obligatoria para pasajeros y encomiendas.
  if (!FORMAS_PAGO.includes(body.forma_pago)) errores.push('Elegí la forma de pago: efectivo o transferencia')
  datos.forma_pago = body.forma_pago

  return { errores, datos }
}
