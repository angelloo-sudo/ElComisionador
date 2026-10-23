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
  destino: 'Achiras',
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

  it('acepta una hora estimada de llegada posterior a la salida', () => {
    const { continuo, res } = validar({ ...viajeBase, hora_llegada: '11:30' })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
  })

  it('acepta una duración estimada que termina el mismo día', () => {
    const { continuo, res } = validar({ ...viajeBase, duracion_min: 90 })
    assert.equal(continuo, true)
    assert.equal(res.statusCode, null)
  })

  it('rechaza estimaciones contradictorias, llegada anterior y duración que cruza medianoche', () => {
    const casosInvalidos = [
      { hora_llegada: '09:00', duracion_min: 60 },
      { hora_llegada: '09:55' },
      { duracion_min: 840 },
    ]
    for (const extra of casosInvalidos) {
      const { continuo, res } = validar({ ...viajeBase, ...extra })
      assert.equal(continuo, false, JSON.stringify(extra))
      assert.equal(res.statusCode, 400, JSON.stringify(extra))
    }
  })
})
