import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const testRunId = randomUUID()
const emailPrefix = `qa-cu27-${testRunId}-`
const password = 'ClaveSegura-2026!'
const createdEmails = new Set()
const createdShipmentIds = new Set()
let emailSequence = 0

function newEmail(role) {
  const email = `${emailPrefix}${role}-${++emailSequence}@example.test`
  createdEmails.add(email)
  return email
}

async function registerCustomer() {
  const email = newEmail('cliente')
  const response = await api.post('/api/auth/register').send({
    nombre: 'Ana',
    apellido: 'Cliente',
    email,
    password,
    confirmarPassword: password,
    dni: '12345678',
    telefono: '3511234567',
  })

  assert.equal(response.status, 201, JSON.stringify(response.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

async function registerCommissionaire() {
  const email = newEmail('comisionista')
  const response = await api.post('/api/auth/register-comisionista').send({
    nombre: 'Carlos',
    apellido: 'Comisionista',
    email,
    password,
    confirmarPassword: password,
    dni: '87654321',
    telefono: '3517654321',
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

const shipmentDetails = {
  direccion_retiro: 'Av. Colón 456, Córdoba',
  destinatario_nombre: 'María Destinataria',
  destinatario_telefono: '+54 351 555 0101',
  destinatario_direccion: 'Av. San Martín 123, Córdoba',
  tipo_contenido: 'libros',
  peso_kg: 2,
  dimensiones: '1x1',
  fragil: false,
}

describe('CU27: solicitud de envío de encomienda por un cliente', () => {
  before(async () => {
    await query('SELECT 1')
  })

  afterEach(async () => {
    if (createdShipmentIds.size > 0) {
      await query('DELETE FROM encomiendas WHERE id = ANY($1::int[])', [Array.from(createdShipmentIds)])
      createdShipmentIds.clear()
    }
    if (createdEmails.size > 0) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)])
      createdEmails.clear()
    }
  })

  it('crea la solicitud y deriva el remitente del cliente autenticado', async () => {
    const cliente = await registerCustomer()
    const clienteDb = await query('SELECT id FROM clientes WHERE usuario_id = $1', [cliente.usuario.id])
    const estadoInicial = await api.get('/api/encomiendas/mis-solicitudes')
      .set('Authorization', `Bearer ${cliente.token}`)

    assert.equal(estadoInicial.status, 200)
    assert.equal(estadoInicial.body.primera_solicitud_encomienda_realizada, false)
    assert.deepEqual(estadoInicial.body.solicitudes, [])

    const response = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ ...shipmentDetails, cliente_remitente_id: 999999 })

    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.equal(response.body.encomienda.cliente_remitente_id, clienteDb.rows[0].id)
    assert.equal(response.body.encomienda.remitente_nombre, 'Ana Cliente')
    assert.equal(response.body.encomienda.remitente_telefono, '3511234567')
    assert.equal(response.body.encomienda.direccion_retiro, shipmentDetails.direccion_retiro)
    assert.equal(response.body.encomienda.destinatario_nombre, shipmentDetails.destinatario_nombre)
    assert.equal(response.body.encomienda.destinatario_telefono, shipmentDetails.destinatario_telefono)
    assert.equal(response.body.encomienda.destinatario_direccion, shipmentDetails.destinatario_direccion)
    assert.equal(response.body.encomienda.tipo_contenido, shipmentDetails.tipo_contenido)
    assert.equal(Number(response.body.encomienda.peso_kg), shipmentDetails.peso_kg)
    assert.equal(response.body.encomienda.dimensiones, shipmentDetails.dimensiones)
    assert.equal(response.body.encomienda.fragil, shipmentDetails.fragil)
    assert.equal(response.body.encomienda.descripcion, null)
    assert.equal(response.body.encomienda.estado, 'pendiente')
    assert.equal(response.body.encomienda.estado_pago, null)
    assert.ok(response.body.encomienda.fecha_solicitud)
    assert.equal(response.body.mensaje, 'Solicitud de envío registrada correctamente')
    createdShipmentIds.add(response.body.encomienda.id)

    const estadoRegistrado = await api.get('/api/encomiendas/mis-solicitudes')
      .set('Authorization', `Bearer ${cliente.token}`)
    assert.equal(estadoRegistrado.body.primera_solicitud_encomienda_realizada, true)
    assert.equal(estadoRegistrado.body.solicitudes[0].id, response.body.encomienda.id)
    assert.equal(estadoRegistrado.body.solicitudes[0].historial.length, 1)
    assert.equal(estadoRegistrado.body.solicitudes[0].historial[0].estado, 'pendiente')
  })

  it('solo crea el estado de pago cuando el comisionista acepta', async () => {
    const cliente = await registerCustomer()
    const commissionaire = await registerCommissionaire()

    const created = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send(shipmentDetails)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    createdShipmentIds.add(created.body.encomienda.id)
    assert.equal(created.body.encomienda.estado, 'pendiente')
    assert.equal(created.body.encomienda.estado_pago, null)

    const pending = await api.get('/api/encomiendas/pendientes')
      .set('Authorization', `Bearer ${commissionaire.token}`)
    assert.equal(pending.status, 200)
    assert.equal(pending.body.solicitudes.some((item) => item.id === created.body.encomienda.id), true)

    const accepted = await api.patch(`/api/encomiendas/${created.body.encomienda.id}/aceptar`)
      .set('Authorization', `Bearer ${commissionaire.token}`)
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
    assert.equal(accepted.body.encomienda.estado, 'aceptado')
    assert.equal(accepted.body.encomienda.estado_pago, 'pendiente')

    const retired = await api.patch(`/api/encomiendas/${created.body.encomienda.id}/estado`)
      .set('Authorization', `Bearer ${commissionaire.token}`)
      .send({ estado: 'retirado' })
    assert.equal(retired.status, 200, JSON.stringify(retired.body))
    assert.equal(retired.body.encomienda.estado, 'retirado')
    assert.equal(retired.body.encomienda.estado_pago, 'pendiente')

    const acceptedList = await api.get('/api/encomiendas/aceptadas')
      .set('Authorization', `Bearer ${commissionaire.token}`)
    const retiredRequest = acceptedList.body.solicitudes.find((item) => item.id === created.body.encomienda.id)
    assert.equal(retiredRequest.estado, 'retirado')
    assert.equal(retiredRequest.estado_pago, 'pendiente')

    const noLongerPending = await api.get('/api/encomiendas/pendientes')
      .set('Authorization', `Bearer ${commissionaire.token}`)
    assert.equal(noLongerPending.body.solicitudes.some((item) => item.id === created.body.encomienda.id), false)

    const customerList = await api.get('/api/encomiendas/mis-solicitudes')
      .set('Authorization', `Bearer ${cliente.token}`)
    const acceptedRequest = customerList.body.solicitudes.find((item) => item.id === created.body.encomienda.id)
    assert.equal(acceptedRequest.estado, 'retirado')
    assert.equal(acceptedRequest.estado_pago, 'pendiente')
    assert.deepEqual(acceptedRequest.historial.map((item) => item.estado), ['pendiente', 'aceptado', 'retirado'])
  })

  it('permite modificar y eliminar una solicitud propia sin reiniciar el primer envío', async () => {
    const cliente = await registerCustomer()
    const created = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send(shipmentDetails)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    createdShipmentIds.add(created.body.encomienda.id)

    const updated = await api.put(`/api/encomiendas/${created.body.encomienda.id}`)
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ ...shipmentDetails, destinatario_nombre: 'Nombre actualizado', dimensiones: '2x2' })
    assert.equal(updated.status, 200, JSON.stringify(updated.body))
    assert.equal(updated.body.encomienda.destinatario_nombre, 'Nombre actualizado')
    assert.equal(updated.body.encomienda.dimensiones, '2x2')

    const deleted = await api.delete(`/api/encomiendas/${created.body.encomienda.id}`)
      .set('Authorization', `Bearer ${cliente.token}`)
    assert.equal(deleted.status, 200)

    const finalState = await api.get('/api/encomiendas/mis-solicitudes')
      .set('Authorization', `Bearer ${cliente.token}`)
    assert.equal(finalState.body.primera_solicitud_encomienda_realizada, true)
    assert.deepEqual(finalState.body.solicitudes, [])
  })

  it('no permite listar, modificar ni eliminar solicitudes de otro cliente', async () => {
    const remitente = await registerCustomer()
    const otroCliente = await registerCustomer()
    const created = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${remitente.token}`)
      .send(shipmentDetails)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    createdShipmentIds.add(created.body.encomienda.id)

    const anotherList = await api.get('/api/encomiendas/mis-solicitudes')
      .set('Authorization', `Bearer ${otroCliente.token}`)
    const attemptedUpdate = await api.put(`/api/encomiendas/${created.body.encomienda.id}`)
      .set('Authorization', `Bearer ${otroCliente.token}`)
      .send(shipmentDetails)
    const attemptedDelete = await api.delete(`/api/encomiendas/${created.body.encomienda.id}`)
      .set('Authorization', `Bearer ${otroCliente.token}`)

    assert.deepEqual(anotherList.body.solicitudes, [])
    assert.equal(attemptedUpdate.status, 404)
    assert.equal(attemptedDelete.status, 404)
  })

  it('rechaza la solicitud sin autenticación o con un rol distinto de cliente', async () => {
    const anonymous = await api.post('/api/encomiendas').send(shipmentDetails)
    assert.equal(anonymous.status, 401)

    const commissionaire = await registerCommissionaire()

    const forbidden = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${commissionaire.token}`)
      .send(shipmentDetails)

    assert.equal(forbidden.status, 403)
  })

  it('valida los datos obligatorios y los límites de longitud', async () => {
    const cliente = await registerCustomer()
    const incomplete = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ ...shipmentDetails, dimensiones: '3x3' })
    const tooLong = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ ...shipmentDetails, destinatario_nombre: 'N'.repeat(121) })

    assert.equal(incomplete.status, 400)
    assert.equal(tooLong.status, 400)
  })

  it('exige aclaración cuando el contenido es otro', async () => {
    const cliente = await registerCustomer()
    const missingClarification = await api.post('/api/encomiendas')
      .set('Authorization', `Bearer ${cliente.token}`)
      .send({ ...shipmentDetails, tipo_contenido: 'otro' })

    assert.equal(missingClarification.status, 400)
  })
})

after(async () => {
  if (createdShipmentIds.size > 0) {
    await query('DELETE FROM encomiendas WHERE id = ANY($1::int[])', [Array.from(createdShipmentIds)])
  }
  if (createdEmails.size > 0) {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)])
  }
  await pool.end()
})