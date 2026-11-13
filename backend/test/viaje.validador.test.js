import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarViaje } from '../src/validators/viaje.validador.js'

function validar(body) {
  let continuo = false
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  validarViaje({ body }, res, () => { continuo = true })
  return { continuo, res }
}

const viajeBase = {
  origen: 'Achiras',
  destino: 'Córdoba (Capital)',
  fecha: '2028-02-29',
  hora_salida: '10:00',
  cupo_total: 2,
}

describe('validador de fechas de viaje', () => {
  it('rechaza fechas ISO con un día inexistente', () => {
    const { continuo, res } = validar({ ...viajeBase, fecha: '2028-02-30' })

    assert.equal(continuo, false)
    assert.equal(res.statusCode, 400)
    assert.ok(res.body.errores.some((error) => error.includes('formato invalido')))
  })

  it('acepta una fecha bisiesta real', () => {
    const { continuo, res } = validar(viajeBase)

    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
  })

  it('acepta registrar un viaje con cupo inicial de cero', () => {
    const { continuo, res } = validar({ ...viajeBase, cupo_total: 0 })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
  })

  it('acepta la llegada el mismo día y después de medianoche', () => {
    const { continuo, res } = validar({ ...viajeBase, hora_llegada: '11:30' })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
    const cruzaMedianoche = validar({ ...viajeBase, hora_salida: '21:00', hora_llegada: '01:00' })
    assert.equal(cruzaMedianoche.continuo, true)
  })

  it('acepta paradas intermedias en orden horario y con localidades distintas', () => {
    const { continuo, res } = validar({ ...viajeBase, hora_llegada: '14:00', paradas: [
      { localidad: 'Río Cuarto', hora_estimada: '11:00' },
      { localidad: 'Villa María', hora_estimada: '12:30' },
    ] })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
  })

  it('rechaza paradas duplicadas y horarios fuera del orden del viaje', () => {
    const { continuo, res } = validar({ ...viajeBase, hora_llegada: '14:00', paradas: [
      { localidad: 'Río Cuarto', hora_estimada: '12:00' },
      { localidad: 'Río Cuarto', hora_estimada: '11:00' },
    ] })
    assert.equal(continuo, false)
    assert.ok(res.body.errores.some((error) => error.includes('repetida')))
    assert.ok(res.body.errores.some((error) => error.includes('ordenados')))
  })

  it('acepta duraciones estimadas que terminan el mismo día o al día siguiente', () => {
    const { continuo, res } = validar({ ...viajeBase, duracion_min: 90 })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
    assert.equal(validar({ ...viajeBase, hora_salida: '21:00', duracion_min: 240 }).continuo, true)
  })

  it('rechaza estimaciones contradictorias, llegada igual y duración fuera de rango', () => {
    const casosInvalidos = [
      { hora_llegada: '09:00', duracion_min: 60 },
      { hora_llegada: '10:00' },
      { duracion_min: 1440 },
    ]
    for (const extra of casosInvalidos) {
      const { continuo, res } = validar({ ...viajeBase, ...extra })
      assert.equal(continuo, false, JSON.stringify(extra))
      assert.equal(res.statusCode, 400, JSON.stringify(extra))
    }
  })

})
