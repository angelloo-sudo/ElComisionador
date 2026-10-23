import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const runId = randomUUID()
const emails = new Set()
const tripIds = new Set()
let seq = 0
const passwordHash = 'not-used-in-these-tests'

async function crearComisionista() {
  const email = `qa-recordatorio-${runId}-${++seq}@example.test`
  const { rows: [user] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Prueba', 'Recordatorio', $1, $2, 'comisionista', true) RETURNING id`,
    [email, passwordHash],
  )
  emails.add(email)
  await query('INSERT INTO comisionistas (usuario_id) VALUES ($1)', [user.id])
  const token = jwt.sign({ id: user.id, email, rol: 'comisionista' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  return { id: user.id, token }
}

async function crearViaje(usuarioId, dias = 3, estado = 'programado') {
  const fecha = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
  const { rows: [viaje] } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, estado)
     VALUES ($1, 'Córdoba', 'Villa María', $2, '12:00', $3) RETURNING id`,
    [usuarioId, fecha, estado],
  )
  tripIds.add(viaje.id)
  return viaje.id
}

const auth = (session) => ({ Authorization: `Bearer ${session.token}` })

describe('US26: configuración de recordatorio de viaje', () => {
  afterEach(async () => {
    if (tripIds.size) {
      await query('DELETE FROM viajes WHERE id = ANY($1::int[])', [Array.from(tripIds)])
      tripIds.clear()
    }
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })

  it('guarda la anticipación elegida y la devuelve al consultar el viaje', async () => {
    const comisionista = await crearComisionista()
    const viajeId = await crearViaje(comisionista.id)
    const guardado = await api.put(`/api/viajes/${viajeId}/recordatorio`).set(auth(comisionista)).send({ minutos_anticipacion: 1440 })
    assert.equal(guardado.status, 200, JSON.stringify(guardado.body))
    assert.equal(guardado.body.recordatorio.minutos_anticipacion, 1440)
    assert.equal(guardado.body.recordatorio.estado, 'pendiente')

    const consultado = await api.get(`/api/viajes/${viajeId}/recordatorio`).set(auth(comisionista))
    assert.equal(consultado.status, 200)
    assert.equal(consultado.body.recordatorio.minutos_anticipacion, 1440)

    const desactivado = await api.delete(`/api/viajes/${viajeId}/recordatorio`).set(auth(comisionista))
    assert.equal(desactivado.status, 200)
    assert.equal(desactivado.body.recordatorio, null)
    assert.equal((await api.get(`/api/viajes/${viajeId}/recordatorio`).set(auth(comisionista))).body.recordatorio, null)
  })

  it('rechaza una anticipación mayor al tiempo restante y un viaje no programado', async () => {
    const comisionista = await crearComisionista()
    const futuro = await crearViaje(comisionista.id, 2)
    const expirado = await crearViaje(comisionista.id, 2, 'cancelado')

    const demasiado = await api.put(`/api/viajes/${futuro}/recordatorio`).set(auth(comisionista)).send({ minutos_anticipacion: 10080 })
    assert.equal(demasiado.status, 400)
    const noProgramado = await api.put(`/api/viajes/${expirado}/recordatorio`).set(auth(comisionista)).send({ minutos_anticipacion: 60 })
    assert.equal(noProgramado.status, 409)
    const inexistente = await api.put('/api/viajes/2147483647/recordatorio').set(auth(comisionista)).send({ minutos_anticipacion: 60 })
    assert.equal(inexistente.status, 404)
  })

  it('no permite consultar ni configurar el recordatorio de un viaje ajeno', async () => {
    const owner = await crearComisionista()
    const other = await crearComisionista()
    const viajeId = await crearViaje(owner.id)
    assert.equal((await api.get(`/api/viajes/${viajeId}/recordatorio`).set(auth(other))).status, 404)
    assert.equal((await api.put(`/api/viajes/${viajeId}/recordatorio`).set(auth(other)).send({ minutos_anticipacion: 60 })).status, 404)
  })
})

after(async () => { await pool.end() })
