import assert from 'node:assert/strict'
import test from 'node:test'
import { validarAnticipacionRecordatorio } from '../src/validators/recordatorio.validador.js'

test('valida anticipación de recordatorio y tiempo restante', () => {
  assert.equal(validarAnticipacionRecordatorio(60, 3600), null)
  assert.equal(validarAnticipacionRecordatorio(1440, 172800), null)
  assert.match(validarAnticipacionRecordatorio(1440, 3600), /no puede superar/)
  assert.match(validarAnticipacionRecordatorio(0), /entre 1 minuto y 7 días/)
  assert.match(validarAnticipacionRecordatorio(10081), /entre 1 minuto y 7 días/)
  assert.match(validarAnticipacionRecordatorio('60'), /entre 1 minuto y 7 días/)
  assert.match(validarAnticipacionRecordatorio(1, 0), /no puede superar/)
})
