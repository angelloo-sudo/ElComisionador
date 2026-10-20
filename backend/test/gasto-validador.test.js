// Pruebas unitarias (sin base de datos) de las validaciones de gastos y tipos de gasto.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  esFechaISOValida,
  normalizarGasto,
  normalizarTipoGasto,
  parsearId,
  validarMonto,
} from '../src/validators/gasto.validador.js'

const HOY = '2026-10-17'
const gastoValido = { tipo_gasto_id: 1, monto: 15000, fecha: '2026-10-10' }

test('validarMonto acepta números y textos con hasta 2 decimales y devuelve texto exacto', () => {
  assert.deepEqual(validarMonto(1500), { valor: '1500.00' })
  assert.deepEqual(validarMonto('1500.5'), { valor: '1500.50' })
  assert.deepEqual(validarMonto(' 0.01 '), { valor: '0.01' })
  assert.deepEqual(validarMonto('9999999999.99'), { valor: '9999999999.99' })
})

test('validarMonto rechaza vacíos, ceros, negativos, exceso de decimales y valores raros', () => {
  for (const malo of [undefined, null, '', 0, '0', '0.00', -5, '-5', 10.123, '10.123', 'abc', '1e3', '1,5', NaN, Infinity, {}, [], true, '10000000000']) {
    assert.ok(validarMonto(malo).error, `debería rechazar ${JSON.stringify(malo)}`)
  }
})

test('esFechaISOValida rechaza fechas que no existen en el calendario', () => {
  assert.equal(esFechaISOValida('2026-02-28'), true)
  assert.equal(esFechaISOValida('2028-02-29'), true)
  for (const mala of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-10', '26-10-10', '2026/10/10', '', null, undefined, 20261010]) {
    assert.equal(esFechaISOValida(mala), false, `debería rechazar ${JSON.stringify(mala)}`)
  }
})

test('parsearId solo acepta enteros positivos que entran en un INTEGER de PostgreSQL', () => {
  assert.equal(parsearId('12'), 12)
  assert.equal(parsearId(7), 7)
  for (const malo of ['0', '-1', '1.5', 'abc', '', '2147483648', '99999999999999999999', null, undefined, {}, [], '1 OR 1=1']) {
    assert.equal(parsearId(malo), null, `debería rechazar ${JSON.stringify(malo)}`)
  }
})

test('normalizarGasto exige el tipo de gasto (su concepto) y limpia los datos', () => {
  const { errores, datos } = normalizarGasto(
    { tipo_gasto_id: '4', monto: '2500.5', fecha: '2026-10-17', descripcion: '  Taller  ' },
    { hoy: HOY },
  )
  assert.deepEqual(errores, [])
  assert.deepEqual(datos, { tipo_gasto_id: 4, monto: '2500.50', fecha: '2026-10-17', descripcion: 'Taller' })
  for (const malo of [undefined, null, '', 'x', 0, -1]) {
    assert.equal(normalizarGasto({ ...gastoValido, tipo_gasto_id: malo }, { hoy: HOY }).errores.length, 1, JSON.stringify(malo))
  }
})

test('normalizarGasto informa todos los errores a la vez', () => {
  const { errores } = normalizarGasto({}, { hoy: HOY })
  assert.equal(errores.length, 3)
  assert.match(errores.join('|'), /tipo de gasto/i)
  assert.match(errores.join('|'), /monto/i)
  assert.match(errores.join('|'), /fecha/i)
})

test('normalizarGasto valida fecha futura/antigua/inexistente y descripción larga', () => {
  const errorDe = (cambios) => normalizarGasto({ ...gastoValido, ...cambios }, { hoy: HOY }).errores.join('|')
  assert.match(errorDe({ fecha: '2026-10-18' }), /posterior a hoy/)
  assert.match(errorDe({ fecha: '2026-02-31' }), /formato/)
  assert.match(errorDe({ fecha: '1999-12-31' }), /antigua/)
  assert.match(errorDe({ descripcion: 'x'.repeat(501) }), /500/)
  assert.match(errorDe({ descripcion: 123 }), /no es válida/)
  assert.equal(errorDe({ fecha: '2026-10-17' }), '') // hoy se permite
})

test('normalizarTipoGasto normaliza espacios y valida largo y caracteres', () => {
  const ok = normalizarTipoGasto({ nombre: '  Seguro   (auto) ', descripcion: '' })
  assert.deepEqual(ok, { errores: [], datos: { nombre: 'Seguro (auto)', descripcion: null } })

  const errorDe = (body) => normalizarTipoGasto(body).errores.join('|')
  assert.match(errorDe({}), /obligatorio/)
  assert.match(errorDe({ nombre: 'ab' }), /al menos 3/)
  assert.match(errorDe({ nombre: 'a'.repeat(61) }), /60/)
  assert.match(errorDe({ nombre: '<script>' }), /solo puede tener/)
  assert.match(errorDe({ nombre: '-Combustible' }), /solo puede tener/)
  assert.match(errorDe({ nombre: 'Peajes', descripcion: 'x'.repeat(201) }), /200/)
  assert.equal(errorDe({ nombre: 'Año nuevo 2026' }), '')
})
