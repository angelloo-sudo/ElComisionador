import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularLlegadasAcumuladas, minutosDesdeSalida, textoLlegada } from './horarios.js'

test('calcularLlegadasAcumuladas acumula cada tramo desde la salida', () => {
  assert.deepEqual(calcularLlegadasAcumuladas('10:00', [60, 90, 120]), ['11:00', '12:30', '14:30'])
})

test('calcularLlegadasAcumuladas sigue al día siguiente si pasa la medianoche', () => {
  assert.deepEqual(calcularLlegadasAcumuladas('23:30', [31, 60]), ['00:01', '01:01'])
})

test('calcularLlegadasAcumuladas falla si el recorrido dura 24 horas o más', () => {
  assert.equal(calcularLlegadasAcumuladas('10:00', [1000, 440]), null)
})

test('minutosDesdeSalida y textoLlegada contemplan la medianoche', () => {
  assert.equal(minutosDesdeSalida('22:00', '01:30'), 210)
  assert.equal(textoLlegada('22:00', '01:30'), '01:30 (+1 día)')
  assert.equal(textoLlegada('08:00', '10:00:00'), '10:00')
})
