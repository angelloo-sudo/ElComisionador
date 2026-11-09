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
  const { rows: [usuario] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol)
     VALUES ('Nombre', 'Prueba', $1, $2, 'no-usado', $3) RETURNING id`,
    [email, String(20000000 + sequence), rol],
  )
  emails.add(email)
  const token = jwt.sign({ id: usuario.id, email, rol }, process.env.JWT_SECRET, { expiresIn: '1h' })
  return { id: usuario.id, token }
}

const auth = (usuario) => ({ Authorization: `Bearer ${usuario.token}` })
const resultados = {
  dni_parcial: '••••3456',
  resultado_ocr: 'legible',
  coincidencias: { nombre: true, apellido: true, dni: false },
  controles_faciales: { rostro_unico: true, parpadeo: true, giro: true, frente: true },
}

describe('API de verificaciones preliminares', () => {
  afterEach(async () => {
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  it('registra resultados mínimos, limita el acceso al propietario y requiere administrador para resolver', async () => {
    const cliente = await crearUsuario('cliente')
    const otro = await crearUsuario('comisionista')
    const admin = await crearUsuario('administrador')

    const { rows: [solicitudAdmin] } = await query(
      `INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en, enviada_en)
       VALUES ($1, 'PENDIENTE_REVISION', NOW(), NOW()) RETURNING id`,
      [admin.id],
    )
    assert.equal((await api.patch(`/api/verificaciones/admin/${solicitudAdmin.id}/resolver`).set(auth(admin)).send({ decision: 'APROBADA_MANUALMENTE' })).status, 404)

    assert.equal((await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: false })).status, 400)
    const inicio = await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: true })
    assert.equal(inicio.status, 201, JSON.stringify(inicio.body))
    assert.equal(inicio.body.estado, 'EN_PROCESO')
    assert.equal((await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: true })).status, 409)

    const solicitudAjena = await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(otro)).send(resultados)
    assert.equal(solicitudAjena.status, 404)

    const conDniCompleto = await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send({ ...resultados, dni: '30123456' })
    assert.equal(conDniCompleto.status, 400)
    const envio = await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send(resultados)
    assert.equal(envio.status, 200, JSON.stringify(envio.body))
    assert.equal(envio.body.estado, 'PENDIENTE_REVISION')
    assert.equal(envio.body.dni_parcial, resultados.dni_parcial)
    const propias = await api.get('/api/verificaciones/mias').set(auth(cliente))
    assert.equal(propias.status, 200)
    assert.equal(propias.body.length, 1)
    assert.equal(propias.body[0].estado, 'PENDIENTE_REVISION')
    assert.equal((await api.get('/api/verificaciones/mias').set(auth(otro))).body.length, 0)
    assert.equal((await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(cliente)).send({ decision: 'APROBADA_MANUALMENTE' })).status, 403)

    const adminLista = await api.get('/api/verificaciones/admin?estado=PENDIENTE_REVISION').set(auth(admin))
    assert.equal(adminLista.status, 200)
    assert.equal(adminLista.body.some((item) => item.id === inicio.body.id), true)
    assert.equal(adminLista.body.find((item) => item.id === inicio.body.id).dni_cuenta_parcial, '••••0001')
    const detalle = await api.get(`/api/verificaciones/admin/${inicio.body.id}`).set(auth(admin))
    assert.equal(detalle.status, 200)
    assert.equal(detalle.body.id, inicio.body.id)
    assert.equal((await api.get(`/api/verificaciones/admin/${inicio.body.id}`).set(auth(cliente))).status, 403)

    const decision = await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'APROBADA_MANUALMENTE' })
    assert.equal(decision.status, 200, JSON.stringify(decision.body))
    assert.equal(decision.body.estado, 'APROBADA_MANUALMENTE')
    assert.equal(decision.body.resuelta_por, admin.id)
    assert.match(decision.body.alcance, /no certifica la autenticidad/)
    const persisted = await query('SELECT dni_parcial, estado, resuelta_por, coincidencias FROM verificaciones_identidad WHERE id = $1', [inicio.body.id])
    assert.equal(persisted.rows[0].dni_parcial, resultados.dni_parcial)
    assert.equal(JSON.stringify(persisted.rows[0]).includes('30123456'), false)
  })

  it('requiere motivo para rechazar y pedir corrección', async () => {
    const cliente = await crearUsuario('cliente')
    const admin = await crearUsuario('administrador')
    const inicio = await api.post('/api/verificaciones').set(auth(cliente)).send({ consentimiento: true })
    await api.patch(`/api/verificaciones/${inicio.body.id}/enviar`).set(auth(cliente)).send(resultados)
    assert.equal((await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'RECHAZADA' })).status, 400)
    const rechazada = await api.patch(`/api/verificaciones/admin/${inicio.body.id}/resolver`).set(auth(admin)).send({ decision: 'RECHAZADA', motivo: 'El DNI no coincide' })
    assert.equal(rechazada.status, 200)
    assert.equal(rechazada.body.motivo_resolucion, 'El DNI no coincide')
  })
})
