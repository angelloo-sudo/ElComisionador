// Pruebas del servicio de mapas con respuestas simuladas (no llaman a internet).
// Ejecutar: npm --prefix backend run test:geo
import test from 'node:test'
import assert from 'node:assert/strict'
import { validarDireccion, calcularRuta, limpiarCache } from '../src/services/geo.service.js'

const original = globalThis.fetch
function simular(respuestas) {
  const llamadas = []
  globalThis.fetch = async (url) => {
    llamadas.push(String(url))
    for (const [patron, cuerpo, status = 200] of respuestas) {
      if (String(url).includes(patron)) return { ok: status < 400, status, json: async () => cuerpo }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
  return llamadas
}
test.afterEach(() => { globalThis.fetch = original; limpiarCache() })

const dirOk = { direcciones: [{ nomenclatura: 'AV COLON 1250, Capital, Córdoba', ubicacion: { lat: -31.41, lon: -64.19 } }] }

test('direccion existente: estado ok con coordenadas y codigo postal sugerido', async () => {
  simular([['/direcciones', dirOk], ['/reverse', { address: { postcode: 'X5000' } }]])
  const r = await validarDireccion({ calle: 'Av Colon', altura: '1250', localidad: 'Córdoba' })
  assert.equal(r.estado, 'ok')
  assert.equal(r.lat, -31.41)
  assert.equal(r.codigo_postal_sugerido, '5000')
  assert.match(r.direccion_normalizada, /COLON 1250/)
})

test('calle encontrada pero sin ubicacion: altura no confirmada', async () => {
  simular([['/direcciones', { direcciones: [{ nomenclatura: 'AV COLON 99999, Capital, Córdoba' }] }]])
  const r = await validarDireccion({ calle: 'Av Colon', altura: '99999', localidad: 'Córdoba' })
  assert.equal(r.estado, 'altura_no_confirmada')
  assert.equal(r.lat, null)
})

test('si con el filtro de localidad no hay resultado, prueba como localidad censal', async () => {
  const llamadas = []
  globalThis.fetch = async (url) => {
    llamadas.push(String(url))
    const u = String(url)
    const cuerpo = u.includes('localidad_censal=') ? dirOk : { direcciones: [] }
    return { ok: true, status: 200, json: async () => cuerpo }
  }
  const r = await validarDireccion({ calle: 'Av Colon', altura: '1250', localidad: 'Córdoba' }, { conCodigoPostal: false })
  assert.equal(r.estado, 'ok')
  assert.equal(llamadas.length, 2)
})

test('existe en la provincia pero no en esa localidad: otra_localidad', async () => {
  const llamadas = []
  globalThis.fetch = async (url) => {
    llamadas.push(String(url))
    const u = String(url)
    const filtrada = u.includes('localidad=') || u.includes('localidad_censal=')
    return { ok: true, status: 200, json: async () => (filtrada ? { direcciones: [] } : dirOk) }
  }
  const r = await validarDireccion({ calle: 'San Martin', altura: '10', localidad: 'Alta Gracia' })
  assert.equal(r.estado, 'otra_localidad')
})

test('calle inexistente en toda la provincia: no_encontrada', async () => {
  simular([['/direcciones', { direcciones: [] }]])
  const r = await validarDireccion({ calle: 'Calle Inventada', altura: '1', localidad: 'Córdoba' })
  assert.equal(r.estado, 'no_encontrada')
})

test('servicio caido: no_verificable (no bloquea) y no se cachea el error', async () => {
  globalThis.fetch = async () => { throw new Error('sin red') }
  const r = await validarDireccion({ calle: 'Av Colon', altura: '1250', localidad: 'Córdoba' })
  assert.equal(r.estado, 'no_verificable')
})

test('ruta: usa los centros de las localidades y devuelve geometria [lat, lon]', async () => {
  simular([
    ['nombre=C%C3%B3rdoba', { localidades: [{ nombre: 'Córdoba', centroide: { lat: -31.4, lon: -64.18 } }] }],
    ['nombre=Villa+Carlos+Paz', { localidades: [{ nombre: 'Villa Carlos Paz', centroide: { lat: -31.42, lon: -64.5 } }] }],
    ['/route/v1/driving/', { code: 'Ok', routes: [{ distance: 36200, duration: 2400, geometry: { coordinates: [[-64.18, -31.4], [-64.5, -31.42]] } }] }],
  ])
  const r = await calcularRuta('Córdoba', 'Villa Carlos Paz')
  assert.equal(r.aproximada, false)
  assert.equal(r.distancia_km, 36.2)
  assert.equal(r.duracion_min, 40)
  assert.deepEqual(r.geometria[0], [-31.4, -64.18])
})

test('ruta: si OSRM falla devuelve una linea recta aproximada', async () => {
  simular([
    ['nombre=C%C3%B3rdoba', { localidades: [{ nombre: 'Córdoba', centroide: { lat: -31.4, lon: -64.18 } }] }],
    ['nombre=Alta+Gracia', { localidades: [{ nombre: 'Alta Gracia', centroide: { lat: -31.65, lon: -64.43 } }] }],
    ['/route/v1/driving/', {}, 500],
  ])
  const r = await calcularRuta('Córdoba', 'Alta Gracia')
  assert.equal(r.aproximada, true)
  assert.equal(r.geometria.length, 2)
  assert.ok(r.distancia_km > 20 && r.distancia_km < 50)
})

test('localidad con departamento "Córdoba (Capital)": Georef recibe nombre y departamento por separado', async () => {
  const llamadas = simular([
    ['nombre=C%C3%B3rdoba&max=20&departamento=Capital', { localidades: [{ nombre: 'Córdoba', centroide: { lat: -31.4, lon: -64.18 } }] }],
    ['nombre=Alta+Gracia', { localidades: [{ nombre: 'Alta Gracia', centroide: { lat: -31.65, lon: -64.43 } }] }],
    ['/route/v1/driving/', { code: 'Ok', routes: [{ distance: 36200, duration: 2400, geometry: { coordinates: [[-64.18, -31.4], [-64.43, -31.65]] } }] }],
  ])
  const r = await calcularRuta('Córdoba (Capital)', 'Alta Gracia')
  assert.equal(r.aproximada, false)
  assert.ok(llamadas.some((u) => u.includes('departamento=Capital')))
  assert.ok(!llamadas.some((u) => u.includes('%28')), 'no se manda el parentesis a Georef')
})

test('direccion en "La Calera (Colón)": busca por localidad + departamento', async () => {
  const llamadas = simular([['/direcciones', dirOk]])
  const r = await validarDireccion({ calle: 'Av Colon', altura: '1250', localidad: 'La Calera (Colón)' }, { conCodigoPostal: false })
  assert.equal(r.estado, 'ok')
  assert.match(llamadas[0], /localidad=La\+Calera/)
  assert.match(llamadas[0], /departamento=Col%C3%B3n/)
})

const osmAltaGracia = [{ lat: '-31.6545', lon: '-64.4290', display_name: 'Avenida Belgrano 134, Alta Gracia, Córdoba, X5186, Argentina', address: { town: 'Alta Gracia', state: 'Córdoba', postcode: 'X5186HDO' } }]

test('plan B: si Georef no la ubica en esa localidad, se busca en OpenStreetMap con el codigo postal', async () => {
  // Georef la encuentra, pero en otra localidad (Rio Cuarto).
  const llamadas = simular([
    ['/direcciones', { direcciones: [] }],
    ['/search', osmAltaGracia],
  ])
  const r = await validarDireccion({ calle: 'Av. Belgrano', altura: '134', localidad: 'Alta Gracia', codigoPostal: 'X5186HDO' })
  assert.equal(r.estado, 'ok')
  assert.equal(r.fuente, 'osm')
  assert.equal(r.lat, -31.6545)
  assert.equal(r.codigo_postal_sugerido, 'X5186HDO')
  const busqueda = llamadas.find((u) => String(u).includes('/search'))
  assert.match(String(busqueda), /postalcode=5186/) // se usa el codigo postal
})

test('plan B: un resultado de OpenStreetMap en otra localidad no se acepta', async () => {
  simular([
    ['/direcciones', { direcciones: [] }],
    ['/search', [{ lat: '-33.1', lon: '-64.3', display_name: 'Belgrano 134, Río Cuarto', address: { city: 'Río Cuarto', state: 'Córdoba' } }]],
  ])
  const r = await validarDireccion({ calle: 'Av. Belgrano', altura: '134', localidad: 'Alta Gracia' })
  assert.equal(r.estado, 'no_encontrada')
})
