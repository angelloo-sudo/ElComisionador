import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarSolicitud } from '../src/validators/solicitud.validador.js'

const solicitudValida = (extra = {}) => ({
  tipo: 'pasajero',
  origen_calle: 'San Martin',
  origen_altura: '100',
  origen_codigo_postal: '5000',
  destino_calle: 'Colon',
  destino_altura: '200',
  destino_codigo_postal: '5000',
  nombre: 'Ana',
  apellido: 'Perez',
  dni: '30111222',
  telefono: '3512345678',
  cantidad_pasajeros: 2,
  valijas_grandes: 1,
  mochilas_bolsos_mano: 2,
  forma_pago: 'efectivo',
  ...extra,
})

describe('validación del equipaje de pasajeros', () => {
  it('acepta hasta una valija grande y un bolso de mano por pasajero', () => {
    const { errores, datos } = validarSolicitud(solicitudValida())

    assert.deepEqual(errores, [])
    assert.equal(datos.lleva_equipaje, true)
    assert.equal(datos.equipaje_detalle, '1 valija grande y 2 mochilas o bolsos de mano')
  })

  it('incluye la descripción opcional junto al detalle del equipaje', () => {
    const { errores, datos } = validarSolicitud(solicitudValida({
      equipaje_descripcion: 'Valija azul y mochila negra',
    }))

    assert.deepEqual(errores, [])
    assert.equal(datos.equipaje_detalle, '1 valija grande y 2 mochilas o bolsos de mano — Valija azul y mochila negra')
  })

  it('acepta omitir la descripción y rechaza una descripción demasiado larga', () => {
    const sinDescripcion = validarSolicitud(solicitudValida())
    const demasiadoLarga = validarSolicitud(solicitudValida({ equipaje_descripcion: 'a'.repeat(121) }))

    assert.deepEqual(sinDescripcion.errores, [])
    assert.ok(demasiadoLarga.errores.some((error) => error.includes('120 caracteres')))
  })

  it('no permite describir equipaje cuando se indicó que no lleva ninguno', () => {
    const { errores } = validarSolicitud(solicitudValida({
      valijas_grandes: 0,
      mochilas_bolsos_mano: 0,
      equipaje_descripcion: 'Valija azul',
    }))

    assert.ok(errores.includes('Indicá al menos una pieza de equipaje para agregar una descripción'))
  })

  it('rechaza cantidades negativas, fraccionarias o mayores a los pasajeros', () => {
    for (const extra of [
      { valijas_grandes: -1 },
      { valijas_grandes: 1.5 },
      { valijas_grandes: 3 },
      { mochilas_bolsos_mano: 3 },
    ]) {
      const { errores } = validarSolicitud(solicitudValida(extra))
      assert.ok(errores.some((error) => error.includes('entre 0 y la cantidad de pasajeros')), JSON.stringify(extra))
    }
  })

  it('acepta indicar que no lleva equipaje', () => {
    const { errores, datos } = validarSolicitud(solicitudValida({
      valijas_grandes: 0,
      mochilas_bolsos_mano: 0,
    }))

    assert.deepEqual(errores, [])
    assert.equal(datos.lleva_equipaje, false)
    assert.equal(datos.equipaje_detalle, null)
  })

  it('mantiene compatibilidad con solicitudes de clientes anteriores', () => {
    const { errores, datos } = validarSolicitud(solicitudValida({
      lleva_equipaje: true,
      equipaje_detalle: 'Una valija mediana',
      valijas_grandes: undefined,
      mochilas_bolsos_mano: undefined,
    }))

    assert.deepEqual(errores, [])
    assert.equal(datos.equipaje_detalle, 'Una valija mediana')
  })
})
