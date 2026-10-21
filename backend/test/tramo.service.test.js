// Pruebas de las cuentas del tramo (ubicar una localidad sobre la ruta y cortar la ruta). Sin red ni base de datos.
// Ejecutar: npm --prefix backend run test:tramo
import test from 'node:test'
import assert from 'node:assert/strict'
import { ubicarEnRuta, cortarRuta } from '../src/services/tramo.service.js'

// Ruta recta de oeste a este sobre la misma latitud: 5 puntos, 0,34 grados de longitud en total.
const ruta = [[-31.42, -64.18], [-31.42, -64.26], [-31.42, -64.35], [-31.42, -64.44], [-31.42, -64.52]]

test('un punto sobre la ruta queda a la proporcion correcta y sin desvio', () => {
  const r = ubicarEnRuta(ruta, { lat: -31.42, lon: -64.35 })
  assert.ok(r.desvio < 0.01)
  assert.ok(Math.abs(r.s / r.largoTotal - 0.5) < 0.01)
})

test('un punto al costado se proyecta sobre la ruta y informa cuanto se aparta', () => {
  const r = ubicarEnRuta(ruta, { lat: -31.52, lon: -64.35 }) // ~11 km al sur
  assert.ok(r.desvio > 10 && r.desvio < 12, `desvio ${r.desvio}`)
  assert.ok(Math.abs(r.s / r.largoTotal - 0.5) < 0.01)
  assert.ok(Math.abs(r.punto.lat + 31.42) < 1e-6)
})

test('un punto antes del inicio o despues del final se pega al extremo', () => {
  assert.equal(ubicarEnRuta(ruta, { lat: -31.42, lon: -64.0 }).s, 0)
  const fin = ubicarEnRuta(ruta, { lat: -31.42, lon: -64.9 })
  assert.ok(Math.abs(fin.s - fin.largoTotal) < 1e-9)
})

test('cortarRuta devuelve solo la parte entre los dos km pedidos', () => {
  const total = ubicarEnRuta(ruta, { lat: -31.42, lon: -64.52 }).largoTotal
  const parte = cortarRuta(ruta, total * 0.25, total * 0.75)
  assert.ok(parte.length >= 3)
  assert.ok(Math.abs(parte[0][1] - (-64.265)) < 0.02)
  assert.ok(Math.abs(parte.at(-1)[1] - (-64.435)) < 0.02)
  const entera = cortarRuta(ruta, 0, total)
  assert.equal(entera.length, ruta.length)
})
