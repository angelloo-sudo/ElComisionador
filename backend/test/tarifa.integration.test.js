// Tarifa por km del comisionista, duracion automatica del viaje y monto de las solicitudes.
// Usa la base de datos real (como las otras pruebas de integracion) pero simula los servicios
// de mapas (Georef / OSRM), asi que no necesita internet.
// Ejecutar: npm --prefix backend run test:tarifa
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { limpiarCache } from '../src/services/geo.service.js'

const api = request(app)
const fetchOriginal = globalThis.fetch
const corrida = randomUUID().slice(0, 8)
const usuarios = []
let osrmCaido = false
let direccionEn = null // si se define, Georef ubica las direcciones en ese punto { lat, lon }
// Ruta de prueba: recta de oeste a este, de Córdoba (km 0) a Villa Carlos Paz (km 36,5).
const CENTROS = {
  Córdoba: [-31.42, -64.18],
  'Villa Carlos Paz': [-31.42, -64.52],
  'Alta Gracia': [-31.43, -64.35], // sobre la ruta, a la mitad
  'La Falda': [-31.42, -64.45], // sobre la ruta, cerca del final
  Cosquín: [-30.9, -64.4], // lejos de la ruta
}
const RUTA_COORDS = [[-64.18, -31.42], [-64.26, -31.42], [-64.35, -31.42], [-64.44, -31.42], [-64.52, -31.42]]

// Km en linea recta de una lista de puntos "lon,lat;lon,lat;..." (ruta simulada).
function kmRecta(coordenadas) {
  const p = coordenadas.split(';').map((c) => c.split(',').map(Number))
  let total = 0
  for (let i = 0; i < p.length - 1; i++) {
    total += Math.hypot((p[i + 1][0] - p[i][0]) * Math.cos((p[i][1] * Math.PI) / 180) * 111.32, (p[i + 1][1] - p[i][1]) * 110.57)
  }
  return total
}

function simularMapas() {
  globalThis.fetch = async (url) => {
    const u = String(url)
    const json = (cuerpo) => ({ ok: true, status: 200, json: async () => cuerpo })
    if (u.includes('/localidades')) {
      const nombre = decodeURIComponent(new URL(u).searchParams.get('nombre'))
      assert.ok(!nombre.includes('('), 'a Georef se le pasa el nombre sin el departamento')
      const centro = CENTROS[nombre] ?? [-31.42 + nombre.length / 100, -64.18 - nombre.length / 100]
      return json({ localidades: [{ nombre, centroide: { lat: centro[0], lon: centro[1] } }] })
    }
    if (u.includes('/route/v1')) {
      if (osrmCaido) return { ok: false, status: 503, json: async () => ({}) }
      // Distancia de la ruta simulada: proporcional a la distancia en linea recta (el viaje completo da 36,5 km).
      const recta = kmRecta(new URL(u).pathname.split('/').pop())
      return json({ code: 'Ok', routes: [{ distance: Math.round(recta * (36.5 / 32.3) * 1000), duration: 2700, geometry: { coordinates: [[-64.18, -31.42], [-64.5, -31.4]] } }] })
    }
    if (u.includes('/table/v1')) {
      // Matriz de distancias (m) entre todos los puntos, con el mismo factor que las rutas simuladas.
      const pts = new URL(u).pathname.split('/').pop().split(';')
      return json({ code: 'Ok', distances: pts.map((a) => pts.map((b) => kmRecta(`${a};${b}`) * (36.5 / 32.3) * 1000)) })
    }
    if (u.includes('/direcciones')) {
      // Por defecto la direccion queda en el centro de su localidad.
      const par = new URL(u).searchParams
      const centro = CENTROS[par.get('localidad') ?? par.get('localidad_censal')]
      const donde = direccionEn ?? (centro ? { lat: centro[0], lon: centro[1] } : { lat: -31.4, lon: -64.2 })
      return json({ direcciones: [{ nomenclatura: 'CALLE 123', ubicacion: donde }] })
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
}

async function crearUsuario(rol) {
  const email = `qa-tarifa-${corrida}-${usuarios.length}@example.test`
  const { rows: [u] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol) VALUES ('Prueba', 'Tarifa', $1, 'x', $2) RETURNING id`,
    [email, rol],
  )
  const tabla = rol === 'comisionista' ? 'comisionistas' : 'clientes'
  await query(`INSERT INTO ${tabla} (usuario_id) VALUES ($1)`, [u.id])
  usuarios.push(u.id)
  const token = jwt.sign({ id: u.id, email, rol }, process.env.JWT_SECRET, { expiresIn: '1h' })
  return { id: u.id, auth: { Authorization: `Bearer ${token}` } }
}

function fechaFutura(dias = 10) {
  const d = new Date(Date.now() + dias * 86400000)
  return d.toISOString().slice(0, 10)
}

const viajeBase = (extra = {}) => ({ origen: 'Córdoba (Capital)', destino: 'Villa Carlos Paz', fecha: fechaFutura(), hora_salida: '08:00', cupo_total: 4, ...extra })

const solicitudPasajero = (viajeId, extra = {}) => ({
  viaje_id: viajeId, tipo: 'pasajero',
  origen_calle: 'Colon', origen_altura: '100', origen_codigo_postal: '5000',
  destino_calle: 'San Martin', destino_altura: '200', destino_codigo_postal: '5000',
  nombre: 'Ana', apellido: 'Perez', dni: '30111222', telefono: '3512345678',
  lleva_equipaje: false, cantidad_pasajeros: 2, forma_pago: 'efectivo', ...extra,
})

describe('tarifa por km y duracion automatica', () => {
  let comisionista
  let cliente

  before(async () => {
    comisionista = await crearUsuario('comisionista')
    cliente = await crearUsuario('cliente')
  })
  afterEach(() => { osrmCaido = false; limpiarCache(); simularMapas() })
  after(async () => {
    globalThis.fetch = fetchOriginal
    await query('DELETE FROM usuarios WHERE id = ANY($1::int[])', [usuarios])
    await pool.end()
  })
  simularMapas()

  it('el comisionista configura su precio por km (y solo el comisionista)', async () => {
    assert.equal((await api.get('/api/tarifa').set(comisionista.auth)).body.precio_km, null)
    assert.equal((await api.get('/api/tarifa').set(cliente.auth)).status, 403)
    for (const malo of [0, -5, 'abc', 2_000_000]) {
      const r = await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: malo })
      assert.equal(r.status, 400, `precio ${malo}`)
    }
    const ok = await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: '350,5' })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.precio_km, 350.5)
    assert.equal((await api.get('/api/tarifa').set(comisionista.auth)).body.precio_km, 350.5)
    const quitar = await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: null })
    assert.equal(quitar.body.precio_km, null)
    await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: 400 })
  })

  it('al registrar un viaje no pide hora de llegada: el sistema calcula distancia, duracion y llegada', async () => {
    const r = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ hora_llegada: '09:00' }))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(Number(r.body.distancia_km), 36.5)
    assert.equal(r.body.duracion_min, 45)
    assert.equal(r.body.hora_llegada.slice(0, 5), '08:45') // se ignora lo que mande el cliente
  })

  it('si el servicio de mapas esta caido el viaje igual se registra, sin duracion', async () => {
    osrmCaido = true
    const r = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(11), hora_salida: '10:00' }))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.duracion_min, null)
    assert.equal(r.body.hora_llegada, null)
  })

  it('el precio de la solicitud = precio/km x km x pasajeros (encomienda: una sola vez)', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(12) }))
    const lista = await api.get('/api/solicitudes/viajes-disponibles').set(cliente.auth)
    const visto = lista.body.find((v) => v.viaje_id === viaje.id)
    assert.equal(Number(visto.precio_pasajero), 14600)
    assert.equal(visto.precio_km, undefined) // el cliente no ve la tarifa ni los km
    assert.equal(visto.distancia_km, undefined)
    assert.equal(visto.duracion_min, 45)

    const pas = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id))
    assert.equal(pas.status, 201, JSON.stringify(pas.body))
    assert.equal(Number(pas.body.monto), 400 * 36.5 * 2) // 29200

    const enc = await api.post('/api/solicitudes').set(cliente.auth).send({
      viaje_id: viaje.id, tipo: 'encomienda',
      origen_calle: 'Colon', origen_altura: '100', origen_codigo_postal: '5000',
      destino_calle: 'San Martin', destino_altura: '200', destino_codigo_postal: '5000',
      peso_kg: 2, ancho_cm: 20, largo_cm: 30, fragil: false, tipo_contenido: 'ropa',
      emisor_nombre: 'Ana', emisor_apellido: 'Perez', emisor_telefono: '3512345678',
      receptor_nombre: 'Luis', receptor_apellido: 'Gomez', receptor_telefono: '3519876543',
      forma_pago: 'transferencia',
    })
    assert.equal(enc.status, 201, JSON.stringify(enc.body))
    assert.equal(Number(enc.body.monto), 400 * 36.5)

    // Si el comisionista cambia la tarifa, las solicitudes ya enviadas conservan su precio.
    await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: 999 })
    const mias = await api.get('/api/solicitudes/mias').set(cliente.auth)
    const guardada = mias.body.find((s) => s.id === pas.body.id)
    assert.equal(Number(guardada.monto), 29200)
    assert.equal(guardada.precio_km, undefined)
    assert.equal(guardada.duracion_min, 45)
    const recibidas = await api.get('/api/solicitudes/recibidas?estado=todas').set(comisionista.auth)
    assert.equal(Number(recibidas.body.find((s) => s.id === pas.body.id).monto), 29200)
    await api.put('/api/tarifa').set(comisionista.auth).send({ precio_km: 400 })
  })

  it('un viaje creado sin ruta se completa al postularse un cliente cuando el mapa vuelve', async () => {
    osrmCaido = true
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(13), hora_salida: '14:00' }))
    assert.equal(viaje.duracion_min, null)
    osrmCaido = false
    limpiarCache()
    const r = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { cantidad_pasajeros: 1 }))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(Number(r.body.monto), 400 * 36.5)
    const { rows: [v] } = await query('SELECT distancia_km, duracion_min, hora_llegada FROM viajes WHERE id = $1', [viaje.id])
    assert.equal(Number(v.distancia_km), 36.5)
    assert.equal(v.duracion_min, 45)
    assert.equal(v.hora_llegada.slice(0, 5), '14:45')
  })

  it('sin tarifa configurada la solicitud se crea igual, sin monto', async () => {
    const otro = await crearUsuario('comisionista')
    const { body: viaje } = await api.post('/api/viajes').set(otro.auth).send(viajeBase({ fecha: fechaFutura(14) }))
    const r = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.monto, null)
  })

  it('modificar un viaje recalcula la duracion y la llegada', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(15), hora_salida: '06:00' }))
    const r = await api.put(`/api/viajes/${viaje.id}`).set(comisionista.auth).send({
      origen: 'Córdoba (Capital)', destino: 'Villa Carlos Paz', fecha: fechaFutura(15), hora_salida: '07:00', cupo_total: 4,
    })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.viajes[0].hora_llegada.slice(0, 5), '07:45')
    assert.equal(r.body.viajes[0].duracion_min, 45)
    // Si el mapa falla al modificar, se conservan los datos que ya tenia (mismo recorrido).
    osrmCaido = true
    limpiarCache()
    const r2 = await api.put(`/api/viajes/${viaje.id}`).set(comisionista.auth).send({
      origen: 'Córdoba (Capital)', destino: 'Villa Carlos Paz', fecha: fechaFutura(15), hora_salida: '07:00', cupo_total: 5,
    })
    assert.equal(r2.status, 200, JSON.stringify(r2.body))
    assert.equal(r2.body.viajes[0].duracion_min, 45)
  })
  it('paradas: si baja antes del destino, el tramo y el precio son menores', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(16) }))
    const completo = await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo`).set(cliente.auth)
    assert.equal(completo.body.estado, 'ok')
    assert.equal(completo.body.precio_persona, 14600)
    assert.equal(completo.body.completo, true)

    const q = new URLSearchParams({ desde: 'Córdoba (Capital)', hasta: 'Alta Gracia' })
    const parcial = await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo?${q}`).set(cliente.auth)
    assert.equal(parcial.body.estado, 'ok')
    assert.ok(parcial.body.precio_persona > 14600 * 0.45 && parcial.body.precio_persona < 14600 * 0.55, `precio ${parcial.body.precio_persona}`)
    assert.ok(parcial.body.geometria.length >= 2)
    assert.equal(parcial.body.hasta.nombre, 'Alta Gracia')
    assert.equal(parcial.body.km, undefined) // el cliente no ve los km
    assert.equal(parcial.body.precio_km, undefined)

    // Se postula subiendo en el origen y bajando en Alta Gracia, 2 pasajeros.
    const r = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { origen_localidad: 'Córdoba (Capital)', destino_localidad: 'Alta Gracia' }))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(Number(r.body.monto), Math.round(parcial.body.precio_persona * 2 * 100) / 100)
    const { rows: [fila] } = await query('SELECT origen_localidad, destino_localidad, distancia_km, precio_km FROM solicitudes_viaje WHERE id = $1', [r.body.id])
    assert.equal(fila.destino_localidad, 'Alta Gracia')
    assert.ok(Number(fila.distancia_km) > 17 && Number(fila.distancia_km) < 19.5)
    assert.equal(Number(fila.precio_km), 400)
    const recibida = await api.get(`/api/solicitudes/${r.body.id}/tramo`).set(comisionista.auth)
    assert.equal(recibida.body.estado, 'ok')
    assert.equal(recibida.body.completo, false)
    assert.equal((await api.get(`/api/solicitudes/${r.body.id}/tramo`).set(cliente.auth)).status, 403)
  })

  it('paradas: una localidad intermedia puede ser la de subida, y las que no estan en el recorrido o van en desorden se rechazan', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(17) }))
    const tramo = async (desde, hasta) => (await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo?${new URLSearchParams({ desde, hasta })}`).set(cliente.auth)).body
    const medio = await tramo('Alta Gracia', 'Villa Carlos Paz')
    assert.equal(medio.estado, 'ok')
    assert.ok(medio.precio_persona > 14600 * 0.45 && medio.precio_persona < 14600 * 0.55)
    const entre = await tramo('Alta Gracia', 'La Falda')
    assert.equal(entre.estado, 'ok')
    assert.ok(entre.precio_persona < medio.precio_persona)

    assert.equal((await tramo('Cosquín', 'Villa Carlos Paz')).estado, 'invalido') // fuera del recorrido
    const alReves = await tramo('La Falda', 'Alta Gracia')
    assert.equal(alReves.estado, 'invalido')
    assert.match(alReves.mensaje, /después de/)
    assert.equal((await tramo('Alta Gracia', 'Alta Gracia')).estado, 'invalido')

    const mala = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { origen_localidad: 'Cosquín', destino_localidad: 'Villa Carlos Paz' }))
    assert.equal(mala.status, 400)
    assert.match(mala.body.mensaje, /no está sobre el recorrido/)
  })

  it('paradas: con calle y altura verificadas el tramo se mide desde la direccion exacta, no desde el centro de la localidad', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(18) }))
    const base = { desde: 'Córdoba (Capital)', hasta: 'Alta Gracia' }
    const consulta = async (extra = {}) => (await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo?${new URLSearchParams({ ...base, ...extra })}`).set(cliente.auth)).body
    const centro = await consulta()
    assert.equal(centro.hasta.precisa, false)
    try {
      // La direccion de Alta Gracia queda mas cerca de Cordoba que el centro de la localidad: menos km, menos precio.
      direccionEn = { lat: -31.42, lon: -64.28 }
      limpiarCache()
      const exacto = await consulta({ hasta_calle: 'Belgrano', hasta_altura: '100' })
      assert.equal(exacto.estado, 'ok')
      assert.equal(exacto.hasta.precisa, true)
      assert.ok(Math.abs(exacto.hasta.lon - -64.28) < 1e-6) // el pin queda en la direccion
      assert.ok(exacto.precio_persona < centro.precio_persona, `${exacto.precio_persona} vs ${centro.precio_persona}`)

      // La solicitud guarda los km del tramo exacto y el comisionista ve el mismo tramo.
      const r = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, {
        origen_localidad: 'Córdoba (Capital)', destino_localidad: 'Alta Gracia', destino_calle: 'Belgrano', destino_altura: '100',
      }))
      assert.equal(r.status, 201, JSON.stringify(r.body))
      assert.equal(Number(r.body.monto), Math.round(exacto.precio_persona * 2 * 100) / 100)
      const recibida = await api.get(`/api/solicitudes/${r.body.id}/tramo`).set(comisionista.auth)
      assert.equal(recibida.body.hasta.precisa, true)
    } finally { direccionEn = null; limpiarCache() }
  })

  it('paradas: si la parada obliga a desviarse de la ruta, el desvio tambien se cobra (solo a ese cliente)', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(19) }))
    const consulta = async (extra = {}) => (await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo?${new URLSearchParams({ desde: 'Córdoba (Capital)', hasta: 'Alta Gracia', ...extra })}`).set(cliente.auth)).body
    try {
      direccionEn = { lat: -31.42, lon: -64.35 } // sobre la ruta
      limpiarCache()
      const enRuta = await consulta({ hasta_calle: 'Belgrano', hasta_altura: '100' })
      direccionEn = { lat: -31.47, lon: -64.35 } // ~5,5 km al costado de la ruta
      limpiarCache()
      const desviada = await consulta({ hasta_calle: 'Belgrano', hasta_altura: '100' })
      assert.equal(desviada.estado, 'ok')
      assert.ok(desviada.precio_persona > enRuta.precio_persona, `${desviada.precio_persona} vs ${enRuta.precio_persona}`)
      assert.ok(desviada.precio_persona < enRuta.precio_persona * 1.4)
      // El viaje completo sigue costando lo acordado.
      const completo = await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/tramo`).set(cliente.auth)
      assert.equal(completo.body.precio_persona, 14600)
    } finally { direccionEn = null; limpiarCache() }
  })

  it('paradas del viaje: el comisionista ve las de los aceptados con la ruta sugerida; el cliente solo las localidades', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(20) }))
    const antes = await api.get(`/api/viajes/${viaje.id}/paradas`).set(comisionista.auth)
    assert.deepEqual(antes.body.paradas, [])
    assert.equal(antes.body.sugerencia.estado, 'sin_paradas')

    const r = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { origen_localidad: 'Alta Gracia', destino_localidad: 'La Falda' }))
    assert.equal(r.status, 201, JSON.stringify(r.body))
    // Pendiente: el comisionista la ve, pero el cliente (y la ruta sugerida) todavia no.
    const pendiente = await api.get(`/api/viajes/${viaje.id}/paradas`).set(comisionista.auth)
    assert.equal(pendiente.body.paradas.length, 2)
    assert.ok(pendiente.body.paradas.every((p) => p.estado === 'pendiente'))
    assert.equal(pendiente.body.sugerencia.estado, 'sin_paradas')
    assert.deepEqual((await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/paradas`).set(cliente.auth)).body.paradas, [])

    assert.equal((await api.patch(`/api/solicitudes/${r.body.id}/aceptar`).set(comisionista.auth)).status, 200)
    const vistas = await api.get(`/api/viajes/${viaje.id}/paradas`).set(comisionista.auth)
    assert.deepEqual(vistas.body.paradas.map((p) => [p.accion, p.localidad, p.estado]), [['sube', 'Alta Gracia', 'aceptada'], ['baja', 'La Falda', 'aceptada']])
    assert.ok(vistas.body.paradas[0].persona && vistas.body.paradas[0].direccion)
    assert.equal(vistas.body.sugerencia.estado, 'ok')
    assert.equal(vistas.body.sugerencia.mejora, false) // sobre una recta el orden natural ya es el mejor
    assert.deepEqual(vistas.body.sugerencia.orden.map((p) => p.accion), ['sube', 'baja'])
    assert.ok(vistas.body.sugerencia.geometria.length >= 2)

    const publicas = await api.get(`/api/solicitudes/viajes-disponibles/${viaje.id}/paradas`).set(cliente.auth)
    assert.deepEqual(publicas.body.paradas.map((p) => [p.localidad, p.acciones]), [['Alta Gracia', ['sube']], ['La Falda', ['baja']]])
    const texto = JSON.stringify(publicas.body)
    assert.ok(!texto.includes('Belgrano') && !texto.includes('persona') && !texto.includes('direccion'))
    // Otro comisionista no puede ver las paradas de este viaje, y un cliente no usa la ruta del comisionista.
    assert.equal((await api.get(`/api/viajes/${viaje.id}/paradas`).set(cliente.auth)).status, 403)
  })

  it('el codigo postal reemplaza al barrio: es obligatorio y se valida', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(21) }))
    const sinCp = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { origen_codigo_postal: '' }))
    assert.equal(sinCp.status, 400)
    assert.match(JSON.stringify(sinCp.body), /código postal/)
    const malo = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { destino_codigo_postal: 'abc' }))
    assert.equal(malo.status, 400)
    // Acepta 4 digitos o CPA (en mayusculas, sin espacios).
    const ok = await api.post('/api/solicitudes').set(cliente.auth).send(solicitudPasajero(viaje.id, { origen_codigo_postal: 'x5000 abc', destino_codigo_postal: '5152' }))
    assert.equal(ok.status, 201, JSON.stringify(ok.body))
    const { rows: [f] } = await query('SELECT origen_codigo_postal, destino_codigo_postal, origen_barrio FROM solicitudes_viaje WHERE id = $1', [ok.body.id])
    assert.deepEqual([f.origen_codigo_postal, f.destino_codigo_postal, f.origen_barrio], ['X5000ABC', '5152', null])
  })

  it('paradas: una encomienda muestra el nombre del emisor (retiro) y del receptor (entrega), no "null null"', async () => {
    const { body: viaje } = await api.post('/api/viajes').set(comisionista.auth).send(viajeBase({ fecha: fechaFutura(22) }))
    const enc = await api.post('/api/solicitudes').set(cliente.auth).send({
      viaje_id: viaje.id, tipo: 'encomienda', origen_localidad: 'Alta Gracia', destino_localidad: 'La Falda',
      origen_calle: 'Colon', origen_altura: '100', origen_codigo_postal: '5000',
      destino_calle: 'San Martin', destino_altura: '200', destino_codigo_postal: '5000',
      peso_kg: 2, ancho_cm: 20, largo_cm: 30, fragil: false, tipo_contenido: 'ropa',
      emisor_nombre: 'Ana', emisor_apellido: 'Perez', emisor_telefono: '3512345678',
      receptor_nombre: 'Luis', receptor_apellido: 'Gomez', receptor_telefono: '3519876543', forma_pago: 'transferencia',
    })
    assert.equal(enc.status, 201, JSON.stringify(enc.body))
    const r = await api.get(`/api/viajes/${viaje.id}/paradas`).set(comisionista.auth)
    assert.deepEqual(r.body.paradas.map((p) => [p.accion, p.persona]), [['retira', 'Ana Perez'], ['entrega', 'Luis Gomez']])
    assert.ok(!JSON.stringify(r.body).includes('null'))
  })

  it('resumen: cada rol ve lo suyo (comisionista: proximo viaje, pendientes y cupos; cliente: proximo traslado y total)', async () => {
    // Usuarios nuevos para que los numeros no dependan de los otros tests.
    const comi = await crearUsuario('comisionista')
    const cli = await crearUsuario('cliente')
    const sinNada = await api.get('/api/resumen').set(comi.auth)
    assert.equal(sinNada.status, 200)
    assert.equal(sinNada.body.proximo_viaje, null)
    assert.equal(sinNada.body.alertas.sin_tarifa, true)
    assert.equal((await api.get('/api/resumen')).status, 401)

    await api.put('/api/tarifa').set(comi.auth).send({ precio_km: 400 })
    const v1 = (await api.post('/api/viajes').set(comi.auth).send(viajeBase({ fecha: fechaFutura(1), cupo_total: 4 }))).body
    const v2 = (await api.post('/api/viajes').set(comi.auth).send(viajeBase({ fecha: fechaFutura(20), cupo_total: 3 }))).body
    const a = await api.post('/api/solicitudes').set(cli.auth).send(solicitudPasajero(v1.id, { cantidad_pasajeros: 1, origen_localidad: 'Alta Gracia', destino_localidad: 'La Falda' }))
    assert.equal(a.status, 201, JSON.stringify(a.body))
    assert.equal((await api.post('/api/solicitudes').set(cli.auth).send(solicitudPasajero(v2.id))).status, 201)

    const r = await api.get('/api/resumen').set(comi.auth)
    assert.equal(r.body.rol, 'comisionista')
    assert.equal(r.body.proximo_viaje.id, v1.id)
    assert.equal(r.body.proximo_viaje.pendientes, 1)
    assert.equal(r.body.totales.viajes_programados, 2)
    assert.equal(r.body.totales.solicitudes_pendientes, 2)
    assert.equal(r.body.totales.cupos_libres, 7)
    assert.equal(r.body.alertas.sin_tarifa, false)
    assert.equal(r.body.alertas.pendientes_urgentes.length, 1) // el viaje de manana tiene una solicitud sin responder
    assert.equal(r.body.pendientes.length, 2)

    assert.equal((await api.patch(`/api/solicitudes/${a.body.id}/aceptar`).set(comi.auth)).status, 200)
    const r2 = await api.get('/api/resumen').set(comi.auth)
    assert.equal(r2.body.totales.cupos_libres, 6)
    assert.equal(r2.body.proximo_viaje.con_paradas, 1)
    assert.equal(r2.body.totales.solicitudes_pendientes, 1)

    const c = await api.get('/api/resumen').set(cli.auth)
    assert.equal(c.body.rol, 'cliente')
    assert.equal(c.body.proximo_traslado.id, a.body.id)
    assert.equal(c.body.proximo_traslado.sube, 'Alta Gracia')
    assert.equal(c.body.totales.aceptadas, 1)
    assert.equal(c.body.totales.pendientes, 1)
    assert.ok(c.body.totales.a_pagar_aceptadas > 0)
    assert.ok(c.body.totales.viajes_disponibles >= 2)
    assert.equal(c.body.ultimas.length, 2)
    assert.ok(!JSON.stringify(c.body).includes('precio_km')) // el cliente no ve la tarifa
  })
})
