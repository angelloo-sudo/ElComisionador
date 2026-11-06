import test from 'node:test'
import assert from 'node:assert/strict'
import { agregarFiltroFechas, fechaISOValida, validarRangoFechas } from '../src/utils/historial-filtros.js'

test('valida fechas ISO reales y rechaza fechas imposibles', () => {
  assert.equal(fechaISOValida('2026-11-06'), true)
  assert.equal(fechaISOValida('2026-02-30'), false)
  assert.equal(fechaISOValida('06-11-2026'), false)
})

test('acepta extremos individuales e inclusivos del rango, sin interpolar valores', () => {
  const params = [7]
  const resultado = agregarFiltroFechas({ desde: '2026-01-01', hasta: '2026-01-31' }, 'v.fecha', params)
  assert.deepEqual(params, [7, '2026-01-01', '2026-01-31'])
  assert.deepEqual(resultado.clauses, [
    'v.fecha >= $2::date',
    "v.fecha < ($3::date + INTERVAL '1 day')",
  ])
  assert.equal(validarRangoFechas({ desde: '2026-01-02', hasta: '2026-01-01' }), 'La fecha de inicio no puede ser posterior a la fecha de fin')
})

test('un filtro de un extremo también funciona y los valores inválidos no alteran parámetros', () => {
  const params = [1]
  assert.deepEqual(agregarFiltroFechas({ desde: '2026-04-01' }, 'v.fecha', params), { clauses: ['v.fecha >= $2::date'] })
  assert.deepEqual(params, [1, '2026-04-01'])
  assert.equal(agregarFiltroFechas({ hasta: 'ayer' }, 'v.fecha', params).error, 'Las fechas deben tener formato AAAA-MM-DD')
  assert.deepEqual(params, [1, '2026-04-01'])
})
