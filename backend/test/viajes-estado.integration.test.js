// US20 (iniciar viaje), US21 (finalizar viaje) y US28 (registrar retiro de encomienda).
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

describe('US20 / US21: iniciar y finalizar viaje', () => {
  afterEach(async () => {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('inicia un viaje programado de hoy y luego lo finaliza', async () => {
    const com = await registrar('comisionista')
    const id = await crearViaje(com.usuario.id)

    const inicio = await api.patch(`/api/viajes/${id}/iniciar`).set(auth(com)).send({})
    assert.equal(inicio.status, 200, JSON.stringify(inicio.body))
    assert.equal(inicio.body.estado, 'en_curso')
    assert.ok(inicio.body.iniciado_en)

    const detalle = await api.get(`/api/viajes/${id}`).set(auth(com))
    assert.equal(detalle.body.estado, 'en_curso')

    const fin = await api.patch(`/api/viajes/${id}/finalizar`).set(auth(com)).send({})
    assert.equal(fin.status, 200, JSON.stringify(fin.body))
    assert.equal(fin.body.estado, 'finalizado')
    assert.ok(fin.body.finalizado_en)
  })

  it('no permite iniciar dos veces, ni viajes futuros, vencidos o cancelados', async () => {
    const com = await registrar('comisionista')
    const hoy = await crearViaje(com.usuario.id)
    const futuro = await crearViaje(com.usuario.id, { fecha: fechaOffset(2) })
    const vencido = await crearViaje(com.usuario.id, { fecha: fechaOffset(-2) })
    const cancelado = await crearViaje(com.usuario.id, { estado: 'cancelado', hora: '15:00' })

    assert.equal((await api.patch(`/api/viajes/${futuro}/iniciar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/viajes/${vencido}/iniciar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch(`/api/viajes/${cancelado}/iniciar`).set(auth(com)).send({})).status, 409)

    assert.equal((await api.patch(`/api/viajes/${hoy}/iniciar`).set(auth(com)).send({})).status, 200)
    const repetido = await api.patch(`/api/viajes/${hoy}/iniciar`).set(auth(com)).send({})
    assert.equal(repetido.status, 409)
    assert.match(repetido.body.mensaje, /ya fue iniciado/)
  })

  it('no permite iniciar otro viaje mientras hay uno en curso', async () => {
    const com = await registrar('comisionista')
    const a = await crearViaje(com.usuario.id, { hora: '08:00' })
    const b = await crearViaje(com.usuario.id, { hora: '18:00' })
    assert.equal((await api.patch(`/api/viajes/${a}/iniciar`).set(auth(com)).send({})).status, 200)

    const r = await api.patch(`/api/viajes/${b}/iniciar`).set(auth(com)).send({})
    assert.equal(r.status, 409)
    assert.equal(r.body.viaje_en_curso_id, a)

    await api.patch(`/api/viajes/${a}/finalizar`).set(auth(com)).send({})
    assert.equal((await api.patch(`/api/viajes/${b}/iniciar`).set(auth(com)).send({})).status, 200)
  })

  it('solo finaliza viajes en curso y no permite finalizar dos veces', async () => {
    const com = await registrar('comisionista')
    const id = await crearViaje(com.usuario.id)
    const sinIniciar = await api.patch(`/api/viajes/${id}/finalizar`).set(auth(com)).send({})
    assert.equal(sinIniciar.status, 409)

    await api.patch(`/api/viajes/${id}/iniciar`).set(auth(com)).send({})
    assert.equal((await api.patch(`/api/viajes/${id}/finalizar`).set(auth(com)).send({})).status, 200)
    const doble = await api.patch(`/api/viajes/${id}/finalizar`).set(auth(com)).send({})
    assert.equal(doble.status, 409)
    assert.match(doble.body.mensaje, /ya fue finalizado/)
  })

  it('un viaje en curso no se puede cancelar ni modificar', async () => {
    const com = await registrar('comisionista')
    const id = await crearViaje(com.usuario.id)
    await api.patch(`/api/viajes/${id}/iniciar`).set(auth(com)).send({})
    assert.equal((await api.patch(`/api/viajes/${id}/cancelar`).set(auth(com)).send({})).status, 409)
  })

  it('no permite operar viajes ajenos ni a clientes', async () => {
    const com = await registrar('comisionista')
    const otro = await registrar('comisionista')
    const cliente = await registrar('cliente')
    const id = await crearViaje(com.usuario.id)

    assert.equal((await api.patch(`/api/viajes/${id}/iniciar`).set(auth(otro)).send({})).status, 404)
    assert.equal((await api.patch(`/api/viajes/${id}/iniciar`).set(auth(cliente)).send({})).status, 403)
    assert.equal((await api.patch(`/api/viajes/${id}/finalizar`).set(auth(otro)).send({})).status, 404)
    assert.equal((await api.patch(`/api/viajes/${id}/iniciar`).send({})).status, 401)
  })
})

describe('US28: registrar retiro de encomienda', () => {
  const ids = []
  afterEach(async () => {
    if (ids.length) await query('DELETE FROM encomiendas WHERE id = ANY($1::int[])', [ids.splice(0)])
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  async function nuevaEncomienda(estado) {
    const { rows } = await query(
      `INSERT INTO encomiendas (remitente_nombre, direccion_retiro, destinatario_nombre, destinatario_telefono,
                                destinatario_direccion, tipo_contenido, peso_kg, dimensiones, fragil, estado, estado_pago)
       VALUES ('Ana', 'Colón 1', 'María', '3510000', 'San Martín 2', 'libros', 1, '1x1', false, $1, 'pendiente')
       RETURNING id`,
      [estado],
    )
    ids.push(rows[0].id)
    return rows[0].id
  }

  it('retira una encomienda aceptada y registra fecha e historial', async () => {
    const com = await registrar('comisionista')
    const id = await nuevaEncomienda('aceptado')

    const r = await api.patch(`/api/encomiendas/${id}/retirar`).set(auth(com)).send({})
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.encomienda.estado, 'retirado')
    assert.ok(r.body.encomienda.retirado_en)

    const hist = await query('SELECT estado FROM historial_encomiendas WHERE encomienda_id = $1 ORDER BY id', [id])
    assert.ok(hist.rows.map((h) => h.estado).includes('retirado'))
  })

  it('rechaza retirar dos veces, o una encomienda pendiente / inexistente', async () => {
    const com = await registrar('comisionista')
    const aceptada = await nuevaEncomienda('aceptado')
    const pendiente = await nuevaEncomienda('pendiente')

    await api.patch(`/api/encomiendas/${aceptada}/retirar`).set(auth(com)).send({})
    const doble = await api.patch(`/api/encomiendas/${aceptada}/retirar`).set(auth(com)).send({})
    assert.equal(doble.status, 409)
    assert.equal((await api.patch(`/api/encomiendas/${pendiente}/retirar`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.patch('/api/encomiendas/99999999/retirar').set(auth(com)).send({})).status, 404)
    assert.equal((await api.patch('/api/encomiendas/abc/retirar').set(auth(com)).send({})).status, 400)
  })

  it('un cliente no puede registrar retiros', async () => {
    const cliente = await registrar('cliente')
    const id = await nuevaEncomienda('aceptado')
    assert.equal((await api.patch(`/api/encomiendas/${id}/retirar`).set(auth(cliente)).send({})).status, 403)
  })
})
