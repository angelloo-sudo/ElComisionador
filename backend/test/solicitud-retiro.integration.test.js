// US28 (flujo de solicitudes): registrar retiro de una encomienda aceptada.
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

async function crearSolicitud(viajeId, clienteUsuarioId, { tipo = 'encomienda', estado = 'aceptada' } = {}) {
  const { rows: c } = await query('SELECT id FROM clientes WHERE usuario_id = $1', [clienteUsuarioId])
  const { rows } = await query(
    `INSERT INTO solicitudes_viaje (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura, cantidad_pasajeros)
     VALUES ($1, $2, $3, $4, 'Calle', '1', 'Calle', '2', $5) RETURNING id`,
    [viajeId, c[0].id, tipo, estado, tipo === 'pasajero' ? 1 : null],
  )
  return rows[0].id
}

describe('US28: registrar retiro de encomienda (solicitudes)', () => {
  afterEach(async () => {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('registra el retiro una sola vez y bloquea la cancelacion del cliente', async () => {
    const com = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const id = await crearSolicitud(viaje, cli.usuario.id)

    const ok = await api.patch(`/api/solicitudes/${id}/retirar`).set(auth(com)).send({})
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.ok(ok.body.retirada_en)

    assert.equal((await api.patch(`/api/solicitudes/${id}/retirar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/solicitudes/${id}/cancelar`).set(auth(cli)).send({})).status, 409)

    const mias = await api.get('/api/solicitudes/mias').set(auth(cli))
    assert.ok(mias.body[0].retirada_en)
    assert.equal(mias.body[0].puede_cancelar, false)
  })

  it('rechaza pasajeros, pendientes, viajes terminados y comisionistas ajenos', async () => {
    const com = await registrar('comisionista')
    const otro = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const pasajero = await crearSolicitud(viaje, cli.usuario.id, { tipo: 'pasajero' })
    const pendiente = await crearSolicitud(viaje, cli.usuario.id, { estado: 'pendiente' })
    const normal = await crearSolicitud(viaje, cli.usuario.id)

    assert.equal((await api.patch(`/api/solicitudes/${pasajero}/retirar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/solicitudes/${pendiente}/retirar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/solicitudes/${normal}/retirar`).set(auth(otro)).send({})).status, 404)
    assert.equal((await api.patch(`/api/solicitudes/${normal}/retirar`).set(auth(cli)).send({})).status, 403)

    await query(`UPDATE viajes SET estado = 'finalizado' WHERE id = $1`, [viaje])
    assert.equal((await api.patch(`/api/solicitudes/${normal}/retirar`).set(auth(com)).send({})).status, 409)
  })

  it('US33: registra la entrega solo despues del retiro y una sola vez', async () => {
    const com = await registrar('comisionista')
    const cli = await registrar('cliente')
    const viaje = await crearViaje(com.usuario.id)
    const id = await crearSolicitud(viaje, cli.usuario.id)

    assert.equal((await api.patch(`/api/solicitudes/${id}/entregar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/solicitudes/${id}/retirar`).set(auth(com)).send({})).status, 200)
    const ok = await api.patch(`/api/solicitudes/${id}/entregar`).set(auth(com)).send({})
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.ok(ok.body.entregada_en)
    assert.equal((await api.patch(`/api/solicitudes/${id}/entregar`).set(auth(com)).send({})).status, 409)

    const mias = await api.get('/api/solicitudes/mias').set(auth(cli))
    assert.ok(mias.body[0].entregada_en)
    assert.equal((await api.patch(`/api/solicitudes/${id}/entregar`).set(auth(cli)).send({})).status, 403)
  })
})
