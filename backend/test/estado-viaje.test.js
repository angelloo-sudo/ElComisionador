import test from 'node:test'
import assert from 'node:assert/strict'
import { obtenerEstadoViaje } from '../src/services/estado-viaje.js'

test('mantiene el viaje programado durante todo el día en Córdoba', () => {
  assert.equal(obtenerEstadoViaje('programado', '2026-10-09', new Date('2026-10-09T21:00:00Z')), 'programado')
  assert.equal(obtenerEstadoViaje('programado', '2026-10-09', new Date('2026-10-10T02:59:59Z')), 'programado')
})

test('marca vencido desde la medianoche siguiente en Córdoba', () => {
  assert.equal(obtenerEstadoViaje('programado', '2026-10-09', new Date('2026-10-10T03:00:00Z')), 'vencido')
  assert.equal(obtenerEstadoViaje('programado', '2026-10-09', new Date('2026-10-13T15:00:00Z')), 'vencido')
})

test('no cambia estados que no sean programado', () => {
  for (const estado of ['en_curso', 'finalizado', 'cancelado']) {
    assert.equal(obtenerEstadoViaje(estado, '2026-10-01', new Date('2026-10-13T15:00:00Z')), estado)
  }
})
