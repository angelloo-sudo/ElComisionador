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
let sequence = 0

async function crearUsuario(rol) {
  const email = `qa-verificacion-${runId}-${++sequence}@example.test`
  const dni = String(20000000 + sequence)
  const { rows: [usuario] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol, email_verificado)
     VALUES ('Nombre', 'Prueba', $1, $2, 'no-usado', $3, true) RETURNING id`, [email, dni, rol],
  )
  emails.add(email)
  const token = jwt.sign({ id: usuario.id, email, rol }, process.env.JWT_SECRET, { expiresIn: '1h' })
  return { id: usuario.id, token, dni }
}

const auth = (usuario) => ({ Authorization: `Bearer ${usuario.token}` })
const datosDocumento = { nombre: 'Nombre', apellido: 'Prueba' }

describe('API de verificaciones de identidad', () => {
  afterEach(async () => {
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  it('compara PDF417, bloquea saltos de etapa y requiere aprobación administrativa', async () => {
    const cliente = await crearUsuario('cliente')
    const otro = await crearUsuario('comisionista')
    const admin = await crearUsuario('administrador')
    const { rows: [propia] } = await query(`INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en, enviada_en) VALUES ($1, 'PENDIENTE_REVISION', NOW(), NOW()) RETURNING id`, [admin.id])
    assert.equal((await api.patch(`/api/verificaciones/admin/${propia.id}/resolver`).set(auth(admin)).send({ decision: 'APROBADA_MANUALMENTE' })).status, 404)
    assert.equal((await api.get('/api/viajes').set(auth(cliente))).status, 403)
    assert.equal((await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: false })).status, 400)

    const inicio = await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: true })
    assert.equal(inicio.status, 201)
    assert.equal((await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({})).status, 403)
    assert.equal((await api.patch(`/api/verificaciones/${inicio.body.id}/documento`).set(auth(cliente)).send({ ...datosDocumento, dni: '' })).status, 422)
    assert.equal((await api.patch(`/api/verificaciones/${inicio.body.id}/documento`).set(auth(cliente)).send({ ...datosDocumento, dni: '20999999' })).body.resultado, 'DATOS_NO_COINCIDENTES')
    const lectura = await api.patch(`/api/verificaciones/${inicio.body.id}/documento`).set(auth(cliente)).send({ ...datosDocumento, dni: cliente.dni })
    assert.equal(lectura.status, 200)
    assert.equal(lectura.body.resultado, 'LECTURA_CORRECTA_Y_COINCIDENTE')
    assert.equal((await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({ estado: 'APROBADA_MANUALMENTE' })).status, 400)
    const envio = await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({})
    assert.equal(envio.status, 200, JSON.stringify(envio.body))
    assert.equal(envio.body.estado, 'PENDIENTE_REVISION')
    assert.equal(envio.body.dni_parcial, `••••${cliente.dni.slice(-4)}`)
    assert.equal((await api.get('/api/verificaciones/mias').set(auth(otro))).body.length, 0)
    assert.equal((await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(cliente)).send({ decision: 'APROBADA_MANUALMENTE' })).status, 403)
    assert.equal((await api.get('/api/viajes').set(auth(cliente))).status, 403)
    const adminLista = await api.get('/api/verificaciones/admin?estado=PENDIENTE_REVISION').set(auth(admin))
    assert.equal(adminLista.status, 200)
    const decision = await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'APROBADA_MANUALMENTE' })
    assert.equal(decision.status, 200)
    assert.match(decision.body.alcance, /no certifica la autenticidad/)
    assert.equal((await api.get('/api/viajes').set(auth(cliente))).status, 200)
    const persisted = await query('SELECT dni_parcial, estado, coincidencias FROM verificaciones_identidad WHERE id = $1', [inicio.body.id])
    assert.equal(persisted.rows[0].dni_parcial, `••••${cliente.dni.slice(-4)}`)
    assert.equal(JSON.stringify(persisted.rows[0]).includes(cliente.dni), false)
  })

  it('requiere coincidencias antes del envío y motivo para rechazar', async () => {
    const cliente = await crearUsuario('cliente')
    const admin = await crearUsuario('administrador')
    const inicio = await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: true })
    await api.patch(`/api/verificaciones/${inicio.body.id}/documento`).set(auth(cliente)).send({ ...datosDocumento, dni: cliente.dni })
    assert.equal((await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({ controles_faciales: { rostro_unico: true } })).status, 400)
    await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({})
    assert.equal((await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'RECHAZADA' })).status, 400)
    const rechazada = await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'RECHAZADA', motivo: 'El código requiere revisión' })
    assert.equal(rechazada.status, 200)
  })
})
