// US22 / US24 / US25: estado del pasajero (a bordo, en destino, ausente, cancelado por el comisionista).
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { hoyEnCordoba } from '../src/services/estado-viaje.js'

const api = request(app)
const prefix = `qa-us20-${randomUUID()}-`
const password = 'ClaveSegura-2026!'
const emails = new Set()
let seq = 0
let contacto = (Date.now() + 7) % 10000000

function datosContacto() {
  contacto += 1
  return { dni: String(10000000 + (contacto % 89999999)), telefono: `351${String(1000000 + (contacto % 8999999))}` }
}

async function registrar(rol) {
  const email = `${prefix}${rol}-${++seq}@example.test`
  emails.add(email)
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const r = await api.post(`/api/auth/${ruta}`).send({
    nombre: 'Test', apellido: rol === 'cliente' ? 'Cliente' : 'Comisionista', email, password, confirmarPassword: password, ...datosContacto(),
  })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

function fechaOffset(dias) {
  const d = new Date(`${hoyEnCordoba()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

async function crearViaje(usuarioId, { fecha = hoyEnCordoba(), estado = 'programado', hora = '08:00' } = {}) {
  const { rows } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, cupo_total, estado)
     VALUES ($1, 'Córdoba', 'Villa María', $2, $3, '10:00', 3, $4) RETURNING id`,
    [usuarioId, fecha, hora, estado],
  )
  return rows[0].id
}

after(async () => { await pool.end() })

const auth = (u) => ({ Authorization: `Bearer ${u.token}` })

async function crearPasajero(viajeId, clienteUsuarioId, cantidad = 1) {
  const { rows: c } = await query('SELECT id FROM clientes WHERE usuario_id = $1', [clienteUsuarioId])
  const { rows } = await query(
    `INSERT INTO solicitudes_viaje (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura, cantidad_pasajeros, nombre, apellido)
     VALUES ($1, $2, 'pasajero', 'aceptada', 'Calle', '1', 'Calle', '2', $3, 'Ana', 'Perez') RETURNING id`,
    [viajeId, c[0].id, cantidad],
  )
  return rows[0].id
}
const iniciar = (com, viaje) => api.patch(`/api/viajes/${viaje}/iniciar`).set(auth(com)).send({})
const cambiar = (com, id, estado) => api.patch(`/api/solicitudes/${id}/pasajero`).set(auth(com)).send({ estado })

describe('Estado del pasajero', () => {
  afterEach(async () => {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('sube (a bordo) y llega a destino con el viaje en curso', async () => {
    const com = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const id = await crearPasajero(viaje, cli.usuario.id)

    // antes de iniciar el viaje no se puede marcar a nadie
    const antes = await cambiar(com, id, 'a_bordo')
    assert.equal(antes.status, 409)
    assert.match(antes.body.mensaje, /iniciar el viaje/)
    assert.equal((await cambiar(com, id, 'ausente')).status, 409)
    assert.equal((await iniciar(com, viaje)).status, 200)

    const subida = await cambiar(com, id, 'a_bordo')
    assert.equal(subida.status, 200, JSON.stringify(subida.body))
    assert.equal(subida.body.estado_pasajero, 'a_bordo')
    assert.ok(subida.body.subio_en)

    const llegada = await cambiar(com, id, 'en_destino')
    assert.equal(llegada.status, 200, JSON.stringify(llegada.body))
    assert.ok(llegada.body.llego_en)
    assert.equal((await cambiar(com, id, 'a_bordo')).status, 409)

    const lista = await api.get(`/api/viajes/${viaje}/pasajeros`).set(auth(com))
    assert.equal(lista.body.pasajeros[0].estado_pasajero, 'en_destino')
    const mias = await api.get('/api/solicitudes/mias').set(auth(cli))
    assert.equal(mias.body[0].estado_pasajero, 'en_destino')
    assert.equal(mias.body[0].puede_cancelar, false)
  })

  it('un pasajero que sube solo puede llegar o volver a pendiente; en destino no se puede saltar', async () => {
    const com = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const id = await crearPasajero(viaje, cli.usuario.id)
    await iniciar(com, viaje)
    assert.equal((await cambiar(com, id, 'en_destino')).status, 409) // sin haber subido
    assert.equal((await cambiar(com, id, 'a_bordo')).status, 200)
    assert.equal((await cambiar(com, id, 'ausente')).status, 409)
    assert.equal((await cambiar(com, id, 'pendiente')).status, 200)
    assert.equal((await cambiar(com, id, 'xx')).status, 400)
  })

  it('ausente y cancelado por el comisionista liberan el cupo', async () => {
    const com = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const a = await crearPasajero(viaje, cli.usuario.id, 2)
    const b = await crearPasajero(viaje, cli.usuario.id, 1)
    await iniciar(com, viaje)
    const ocupados = async () => (await api.get(`/api/viajes/${viaje}`).set(auth(com))).body.ocupados

    assert.equal(await ocupados(), 3)
    assert.equal((await cambiar(com, a, 'ausente')).status, 200)
    assert.equal(await ocupados(), 1)
    assert.equal((await cambiar(com, b, 'cancelado_comisionista')).status, 200)
    assert.equal(await ocupados(), 0)
    assert.equal((await cambiar(com, b, 'pendiente')).status, 409) // cancelado es definitivo
    assert.equal((await cambiar(com, a, 'pendiente')).status, 200) // ausente se puede corregir
    assert.equal(await ocupados(), 2)
  })

  it('solo el comisionista dueno del viaje, y no en viajes terminados', async () => {
    const com = await registrar('comisionista')
    const otro = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const id = await crearPasajero(viaje, cli.usuario.id)
    await iniciar(com, viaje)
    assert.equal((await cambiar(otro, id, 'a_bordo')).status, 404)
    assert.equal((await cambiar(cli, id, 'a_bordo')).status, 403)
    assert.equal((await api.get(`/api/viajes/${viaje}/pasajeros`).set(auth(otro))).status, 404)
    assert.equal((await api.patch(`/api/viajes/${viaje}/finalizar`).set(auth(com)).send({})).status, 200)
    assert.equal((await cambiar(com, id, 'a_bordo')).status, 409)
  })
})
