import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rangoViaje, seSuperponen } from '../src/services/viajes.service.js'

describe('solapamiento de viajes con cambio de fecha', () => {
  it('detecta un viaje que inicia el día siguiente y se cruza con la llegada nocturna', () => {
    const noche = rangoViaje('2026-07-12', '21:00', '01:00')
    const madrugada = rangoViaje('2026-07-13', '00:30', '02:00')
    assert.equal(seSuperponen(noche, madrugada), true)
  })

  it('no considera superpuestos dos viajes contiguos tras medianoche', () => {
    const noche = rangoViaje('2026-07-12', '21:00', '01:00')
    const madrugada = rangoViaje('2026-07-13', '01:00', '02:00')
    assert.equal(seSuperponen(noche, madrugada), false)
  })

  it('compara la hora con el día de inicio para viajes en fechas distintas', () => {
    const primero = rangoViaje('2026-07-12', '08:00', '10:00')
    const segundo = rangoViaje('2026-07-13', '08:00', '10:00')
    assert.equal(seSuperponen(primero, segundo), false)
  })
})
