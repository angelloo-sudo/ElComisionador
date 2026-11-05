import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularLlegadasAcumuladas } from './horarios.js'

test('calcularLlegadasAcumuladas acumula cada tramo desde la salida', () => {
  assert.deepEqual(calcularLlegadasAcumuladas('10:00', [60, 90, 120]), ['11:00', '12:30', '14:30'])
})

test('calcularLlegadasAcumuladas falla si un tramo supera la medianoche', () => {
  assert.equal(calcularLlegadasAcumuladas('23:30', [31]), null)
})
