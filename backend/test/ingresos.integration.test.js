// US35 / US37 / US38 / US39: ingresos automaticos (pasajero en destino, encomienda retirada), detalle, modificacion y anulacion.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { hoyEnCordoba } from '../src/services/estado-viaje.js'

const api = request(app)
const prefix = `qa-ing-${randomUUID()}-`
const password = 'ClaveSegura-2026!'
const emails = new Set()
let seq = 0
let contacto = (Date.now() + 13) % 10000000

function datosContacto() {
  contacto += 1
  return { dni: String(10000000 + (contacto % 89999999)), telefono: `351${String(1000000 + (contacto % 8999999))}` }
}
async function registrar(rol) {
  const email = `${prefix}${rol}-${++seq}@example.test`
  emails.add(email)
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const r = await api.post(`/api/auth/${ruta}`).send({ nombre: 'Test', apellido: 'Prueba', email, password, confirmarPassword: password, ...datosContacto() })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  return login.body
}
const auth = (u) => ({ Authorization: `Bearer ${u.token}` })

async function viaje(usuarioId) {
  const { rows } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, cupo_total, estado)
     VALUES ($1, 'Córdoba', 'Villa María', $2, '08:00', '10:00', 4, 'programado') RETURNING id`, [usuarioId, hoyEnCordoba()])
  return rows[0].id
}
async function solicitud(viajeId, cliUsuarioId, { tipo, monto = 1500 }) {
  const { rows: c } = await query('SELECT id FROM clientes WHERE usuario_id = $1', [cliUsuarioId])
  const { rows } = await query(
    `INSERT INTO solicitudes_viaje (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
       cantidad_pasajeros, nombre, apellido, emisor_nombre, emisor_apellido, monto, forma_pago, origen_localidad, destino_localidad)
     VALUES ($1, $2, $3, 'aceptada', 'Calle', '1', 'Calle', '2', $4, 'Ana', 'Perez', 'Luis', 'Gomez', $5, 'transferencia', 'Córdoba', 'Villa María') RETURNING id`,
    [viajeId, c[0].id, tipo, tipo === 'pasajero' ? 1 : null, monto])
  return rows[0].id
}
after(async () => { await pool.end() })

describe('Ingresos', () => {
  afterEach(async () => {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('registra el ingreso solo cuando el pasajero llega a destino (y una sola vez)', async () => {
    const com = await registrar('comisionista'); const cli = await registrar('cliente')
    const v = await viaje(com.usuario.id)
    const id = await solicitud(v, cli.usuario.id, { tipo: 'pasajero' })

    await api.patch(`/api/viajes/${v}/iniciar`).set(auth(com)).send({})
    assert.equal((await api.patch(`/api/solicitudes/${id}/pasajero`).set(auth(com)).send({ estado: 'a_bordo' })).body.ingreso, null)
    assert.equal((await api.get('/api/finanzas/ingresos').set(auth(com))).body.ingresos.length, 0)

    const llegada = await api.patch(`/api/solicitudes/${id}/pasajero`).set(auth(com)).send({ estado: 'en_destino' })
    assert.equal(llegada.status, 200, JSON.stringify(llegada.body))
    assert.equal(llegada.body.ingreso.monto, '1500.00')

    const lista = await api.get('/api/finanzas/ingresos').set(auth(com))
    assert.equal(lista.body.ingresos.length, 1)
    assert.equal(lista.body.resumen.total, '1500.00')
    assert.equal(lista.body.ingresos[0].forma_pago, 'transferencia')
    assert.equal(lista.body.ingresos[0].tipo_servicio, 'pasajero')
  })

  it('registra el ingreso de la encomienda al retirarla; sin monto no genera ingreso', async () => {
    const com = await registrar('comisionista'); const cli = await registrar('cliente')
    const v = await viaje(com.usuario.id)
    const a = await solicitud(v, cli.usuario.id, { tipo: 'encomienda', monto: 800 })
    const b = await solicitud(v, cli.usuario.id, { tipo: 'encomienda', monto: null })

    const ra = await api.patch(`/api/solicitudes/${a}/retirar`).set(auth(com)).send({})
    assert.equal(ra.status, 200, JSON.stringify(ra.body))
    assert.equal(ra.body.ingreso.monto, '800.00')
    const rb = await api.patch(`/api/solicitudes/${b}/retirar`).set(auth(com)).send({})
    assert.equal(rb.status, 200)
    assert.equal(rb.body.ingreso, null)

    const det = await api.get(`/api/finanzas/ingresos/${ra.body.ingreso.id}`).set(auth(com))
    assert.equal(det.status, 200)
    assert.equal(det.body.tipo_servicio, 'encomienda')
    assert.equal(det.body.cliente, 'Luis Gomez')
    assert.equal(det.body.viaje_id, v)
  })

  it('modifica un ingreso con validaciones y recalcula el total', async () => {
    const com = await registrar('comisionista'); const cli = await registrar('cliente')
    const v = await viaje(com.usuario.id)
    const id = await solicitud(v, cli.usuario.id, { tipo: 'encomienda', monto: 800 })
    const { body } = await api.patch(`/api/solicitudes/${id}/retirar`).set(auth(com)).send({})
    const url = `/api/finanzas/ingresos/${body.ingreso.id}`
    const ok = { monto: '950.50', fecha: hoyEnCordoba(), forma_pago: 'efectivo' }

    for (const malo of [{ monto: 0 }, { monto: -5 }, { monto: 'abc' }, { fecha: '2999-01-01' }, { fecha: 'x' }, { forma_pago: 'cripto' }]) {
      assert.equal((await api.put(url).set(auth(com)).send({ ...ok, ...malo })).status, 400)
    }
    const r = await api.put(url).set(auth(com)).send(ok)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.monto, '950.50')
    assert.equal(r.body.forma_pago, 'efectivo')
    assert.equal((await api.get('/api/finanzas/ingresos').set(auth(com))).body.resumen.total, '950.50')
  })

  it('anula un ingreso: deja de sumar, no se modifica y es privado de cada comisionista', async () => {
    const com = await registrar('comisionista'); const otro = await registrar('comisionista'); const cli = await registrar('cliente')
    const v = await viaje(com.usuario.id)
    const id = await solicitud(v, cli.usuario.id, { tipo: 'encomienda', monto: 800 })
    const ing = (await api.patch(`/api/solicitudes/${id}/retirar`).set(auth(com)).send({})).body.ingreso
    const url = `/api/finanzas/ingresos/${ing.id}`

    assert.equal((await api.patch(`${url}/anular`).set(auth(otro)).send({})).status, 404)
    assert.equal((await api.get(url).set(auth(otro))).status, 404)
    const r = await api.patch(`${url}/anular`).set(auth(com)).send({ motivo: 'Cargado por error' })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.estado, 'anulado')
    assert.equal((await api.patch(`${url}/anular`).set(auth(com)).send({})).status, 409)
    assert.equal((await api.put(url).set(auth(com)).send({ monto: 5, fecha: hoyEnCordoba(), forma_pago: 'efectivo' })).status, 409)

    const activos = await api.get('/api/finanzas/ingresos').set(auth(com))
    assert.equal(activos.body.ingresos.length, 0)
    assert.equal(activos.body.resumen.total, '0.00')
    const todos = await api.get('/api/finanzas/ingresos?estado=todos').set(auth(com))
    assert.equal(todos.body.ingresos.length, 1)
    assert.equal(todos.body.resumen.total, '0.00')
    assert.equal((await api.get('/api/finanzas/ingresos').set(auth(cli))).status, 403)
  })
})
