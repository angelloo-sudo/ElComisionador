import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularHorarioRecorrido } from '../src/services/horario-recorrido.service.js'

test('calcula acumulativamente cada tramo y la llegada final', async () => {
  const minutos = [60, 90, 120]
  const obtenerRuta = async () => ({ aproximada: false, duracion_min: minutos.shift(), distancia_km: 10 })
  const horario = await calcularHorarioRecorrido('Origen', 'Destino', [{ localidad: 'Parada 1' }, { localidad: 'Parada 2' }], '10:00', obtenerRuta)
  assert.deepEqual(horario.paradas.map((p) => p.hora_estimada), ['11:00', '12:30'])
  assert.equal(horario.hora_llegada, '14:30')
  assert.equal(horario.duracion_min, 270)
  assert.equal(horario.distancia_km, 30)
})

test('no inventa horarios cuando una ruta es aproximada', async () => {
  await assert.rejects(
    calcularHorarioRecorrido('Origen', 'Destino', [{ localidad: 'Parada' }], '10:00', async () => ({ aproximada: true, duracion_min: null })),
    /No se pudieron calcular con precisión/,
  )
})

test('permite un recorrido que termina al día siguiente', async () => {
  const minutos = [45, 31]
  const horario = await calcularHorarioRecorrido('Origen', 'Destino', [{ localidad: 'Parada' }], '23:00', async () => ({ aproximada: false, duracion_min: minutos.shift(), distancia_km: 1 }))
  assert.deepEqual(horario.paradas.map((p) => p.hora_estimada), ['23:45'])
  assert.equal(horario.hora_llegada, '00:16')
  assert.equal(horario.duracion_min, 76)
})

test('rechaza un recorrido que dura 24 horas o más', async () => {
  await assert.rejects(
    calcularHorarioRecorrido('Origen', 'Destino', [], '23:30', async () => ({ aproximada: false, duracion_min: 1440, distancia_km: 1 })),
    (error) => error.code === 'HORARIO_MEDIANOCHE',
  )
})
