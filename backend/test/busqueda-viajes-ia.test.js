import test from 'node:test'
import assert from 'node:assert/strict'
import { ErrorBusquedaViajesIA, interpretarBusquedaViajes } from '../src/services/busqueda-viajes-ia.service.js'

const apiKeyOriginal = process.env.GEMINI_API_KEY
const fetchOriginal = globalThis.fetch

test.afterEach(() => {
  if (apiKeyOriginal === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = apiKeyOriginal
  globalThis.fetch = fetchOriginal
})

test('requiere una consulta y una clave de Gemini configurada', async () => {
  delete process.env.GEMINI_API_KEY
  await assert.rejects(interpretarBusquedaViajes(''), { status: 400 })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar desde Córdoba'), { status: 503 })
})

test('extrae filtros estructurados y envía la clave solo en el encabezado', async () => {
  process.env.GEMINI_API_KEY = 'test-secret'
  let solicitud
  globalThis.fetch = async (url, options) => {
    solicitud = { url, options }
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          es_busqueda_viajes: true,
          origen: 'Córdoba',
          destino: 'Villa María',
          fecha: '2026-11-14',
        }) }] } }],
      }),
    }
  }

  assert.deepEqual(await interpretarBusquedaViajes('Quiero viajar de Córdoba a Villa María mañana'), {
    origen: 'Córdoba',
    destino: 'Villa María',
    fecha: '2026-11-14',
  })
  assert.match(solicitud.url, /models\/gemini-3\.5-flash-lite:generateContent$/)
  assert.equal(solicitud.url.includes('test-secret'), false)
  assert.equal(solicitud.options.headers['x-goog-api-key'], 'test-secret')
  assert.equal(JSON.parse(solicitud.options.body).generationConfig.responseMimeType, 'application/json')
})

test('no ejecuta búsquedas ajenas al dominio o sin origen', async () => {
  process.env.GEMINI_API_KEY = 'test-secret'
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"es_busqueda_viajes":false,"origen":null,"destino":null,"fecha":null}' }] } }] }),
  })
  await assert.rejects(interpretarBusquedaViajes('Contame un chiste'), { status: 422 })

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"es_busqueda_viajes":true,"origen":null,"destino":"Villa María","fecha":null}' }] } }] }),
  })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar a Villa María'), {
    name: 'ErrorBusquedaViajesIA',
    status: 422,
  })
})

test('rechaza respuestas con fechas imposibles y maneja fallas de Gemini', async () => {
  process.env.GEMINI_API_KEY = 'test-secret'
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"es_busqueda_viajes":true,"origen":"Córdoba","destino":null,"fecha":"2026-02-30"}' }] } }] }),
  })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar desde Córdoba'), (error) => {
    assert.ok(error instanceof ErrorBusquedaViajesIA)
    assert.equal(error.status, 502)
    return true
  })

  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar desde Córdoba'), { status: 502 })

  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar desde Córdoba'), {
    status: 503,
    message: 'El modelo de Gemini está temporalmente saturado. Intentá de nuevo en unos minutos.',
  })

  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) })
  await assert.rejects(interpretarBusquedaViajes('Quiero viajar desde Córdoba'), {
    status: 503,
    message: 'Gemini rechazó la API key. Revisá que sea válida y que tenga habilitado el acceso a Gemini API.',
  })
})
