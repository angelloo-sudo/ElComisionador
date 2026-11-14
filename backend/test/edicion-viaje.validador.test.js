import test from 'node:test'
import assert from 'node:assert/strict'
import { validarEdicionViaje } from '../src/validators/edicion-viaje.validador.js'

function validar(body) {
  let resultado
  let continuo = false
  const res = { status(codigo) { resultado = { codigo }; return this }, json(cuerpo) { resultado.cuerpo = cuerpo; return this } }
  validarEdicionViaje({ body }, res, () => { continuo = true })
  return { resultado, continuo }
}

test('permite horarios válidos y capacidad entera', () => {
  assert.equal(validar({ hora_salida: '10:30', hora_llegada: '14:00', cupo_total: 8 }).continuo, true)
})

test('acepta cupo cero si el viaje todavía no tiene pasajeros confirmados', () => {
  assert.equal(validar({ hora_salida: '10:30', hora_llegada: '14:00', cupo_total: 0 }).continuo, true)
})

test('rechaza origen, destino, fecha y otros campos no editables', () => {
  const { resultado, continuo } = validar({ hora_salida: '10:30', hora_llegada: '14:00', cupo_total: 8, origen: 'Córdoba' })
  assert.equal(continuo, false)
  assert.equal(resultado.codigo, 400)
  assert.match(resultado.cuerpo.mensaje, /Solo se pueden modificar/)
})

test('rechaza horarios inválidos, llegada igual a la salida y cupo no entero', () => {
  assert.equal(validar({ hora_salida: '25:00', hora_llegada: '26:00', cupo_total: 2 }).continuo, false)
  assert.equal(validar({ hora_salida: '12:00', hora_llegada: '12:00', cupo_total: 2 }).continuo, false)
  assert.equal(validar({ hora_salida: '10:00', hora_llegada: '11:00', cupo_total: 2.5 }).continuo, false)
})

test('acepta un viaje que llega al día siguiente, con paradas pasada la medianoche', () => {
  assert.equal(validar({ hora_salida: '22:00', hora_llegada: '01:30', cupo_total: 2 }).continuo, true)
  assert.equal(validar({ hora_salida: '22:00', hora_llegada: '01:30', cupo_total: 2, paradas: [
    { localidad: 'Villa María', hora_estimada: '23:30' },
    { localidad: 'Bell Ville', hora_estimada: '00:40' },
  ] }).continuo, true)
  assert.equal(validar({ hora_salida: '22:00', hora_llegada: '01:30', cupo_total: 2, paradas: [
    { localidad: 'Villa María', hora_estimada: '00:40' },
    { localidad: 'Bell Ville', hora_estimada: '23:30' },
  ] }).continuo, false)
})
