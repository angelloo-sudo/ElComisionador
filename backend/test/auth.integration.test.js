import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const testRunId = randomUUID()
const emailPrefix = `qa-auth-${testRunId}-`
const password = 'ClaveSegura-2026!'
const createdEmails = new Set()

function emailFor(suffix = randomUUID()) {
  const email = `${emailPrefix}${suffix}@example.test`
  createdEmails.add(email)
  return email
}

async function registerUser(email = emailFor()) {
  const response = await api.post('/api/auth/register').send({
    nombre: 'Usuario de Pruebas',
    email,
    password,
  })

  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.ok(response.body.token)
  assert.ok(response.body.usuario?.id)
  return response
}

describe('autenticacion de clientes', () => {
  before(async () => {
    await query('SELECT 1')
  })

  afterEach(async () => {
    if (createdEmails.size === 0) return

    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)])
    createdEmails.clear()
  })

  it('registra un cliente, normaliza el email y nunca devuelve la contraseña', async () => {
    const email = emailFor('normalizado')
    const response = await api.post('/api/auth/register').send({
      nombre: '  Ana Cliente  ',
      email: `  ${email.toUpperCase()}  `,
      password,
    })

    assert.equal(response.status, 201)
    assert.deepEqual(response.body.usuario.nombre, 'Ana Cliente')
    assert.deepEqual(response.body.usuario.email, email)
    assert.equal('password' in response.body.usuario, false)
    assert.equal('password_hash' in response.body.usuario, false)
    assert.match(response.body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('rechaza registro duplicado aunque cambien mayúsculas o espacios', async () => {
    const email = emailFor('duplicado')
    await registerUser(email)

    const response = await api.post('/api/auth/register').send({
      nombre: 'Segundo registro',
      email: `  ${email.toUpperCase()} `,
      password,
    })

    assert.equal(response.status, 409)
    assert.equal(response.body.mensaje, 'El email ya está registrado')
  })

  it('rechaza credenciales inválidas y entradas de registro incompletas', async () => {
    const email = emailFor('validacion')
    const invalidRequests = [
      { nombre: '', email, password },
      { nombre: 'Sin email', email: '', password },
      { nombre: 'Clave corta', email, password: '12345' },
      { nombre: 'Sin clave', email },
    ]

    for (const body of invalidRequests) {
      const response = await api.post('/api/auth/register').send(body)
      assert.equal(response.status, 400, JSON.stringify({ body, response: response.body }))
    }

    await registerUser(email)
    const wrongPassword = await api.post('/api/auth/login').send({ email, password: 'incorrecta' })
    const unknownEmail = await api.post('/api/auth/login').send({ email: 'no-existe@example.test', password })
    const missingPassword = await api.post('/api/auth/login').send({ email })

    assert.equal(wrongPassword.status, 401)
    assert.equal(unknownEmail.status, 401)
    assert.equal(missingPassword.status, 401)
  })

  it('inicia sesión con email normalizado y devuelve solo datos públicos', async () => {
    const email = emailFor('login')
    await registerUser(email)

    const response = await api.post('/api/auth/login').send({
      email: ` ${email.toUpperCase()} `,
      password,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.usuario.email, email)
    assert.equal('password_hash' in response.body.usuario, false)
    assert.ok(response.body.token)
  })

  it('bloquea el acceso tras tres errores, amplía el segundo bloqueo y reinicia el contador al entrar', async () => {
    const email = emailFor('bloqueo')
    const passwordHash = await bcrypt.hash(password, 10)
    await query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, email_verificado)
       VALUES ('Usuario', 'De Prueba', $1, $2, 'cliente', true)`,
      [email, passwordHash],
    )

    for (let intento = 1; intento <= 2; intento += 1) {
      const response = await api.post('/api/auth/login').send({ email, password: 'incorrecta' })
      assert.equal(response.status, 401)
    }

    const primerBloqueo = await api.post('/api/auth/login').send({ email, password: 'incorrecta' })
    assert.equal(primerBloqueo.status, 429)
    assert.equal(primerBloqueo.body.codigo, 'CUENTA_BLOQUEADA')
    assert.ok(primerBloqueo.body.retryAfterSeconds >= 1 && primerBloqueo.body.retryAfterSeconds <= 30)

    const intentoDuranteBloqueo = await api.post('/api/auth/login').send({ email, password })
    assert.equal(intentoDuranteBloqueo.status, 429)

    await query(
      `UPDATE usuarios
       SET login_locked_until = NOW() - INTERVAL '1 second', login_failed_attempts = 0
       WHERE email = $1`,
      [email],
    )

    for (let intento = 1; intento <= 2; intento += 1) {
      const response = await api.post('/api/auth/login').send({ email, password: 'incorrecta' })
      assert.equal(response.status, 401)
    }

    const accesoValido = await api.post('/api/auth/login').send({ email, password })
    assert.equal(accesoValido.status, 200)
    const estadoReiniciado = await query(
      `SELECT login_failed_attempts, login_lock_level, login_locked_until
       FROM usuarios WHERE email = $1`,
      [email],
    )
    assert.deepEqual(estadoReiniciado.rows[0], {
      login_failed_attempts: 0,
      login_lock_level: 0,
      login_locked_until: null,
    })

    await query(
      `UPDATE usuarios
       SET login_failed_attempts = 2,
           login_lock_level = 1,
           login_locked_until = NOW() - INTERVAL '1 second'
       WHERE email = $1`,
      [email],
    )
    const segundoBloqueo = await api.post('/api/auth/login').send({ email, password: 'incorrecta' })
    assert.equal(segundoBloqueo.status, 429)
    assert.ok(segundoBloqueo.body.retryAfterSeconds >= 119 && segundoBloqueo.body.retryAfterSeconds <= 120)

    const intentoDuranteSegundoBloqueo = await api.post('/api/auth/login').send({ email, password })
    assert.equal(intentoDuranteSegundoBloqueo.status, 429)
  })

  it('consulta el perfil público y el perfil autenticado sin filtrar secretos', async () => {
    const registration = await registerUser(emailFor('perfil'))
    const { id } = registration.body.usuario
    const token = registration.body.token

    const publicProfile = await api.get(`/api/auth/perfil/${id}`)
    const ownProfile = await api.get('/api/auth/perfil').set('Authorization', `Bearer ${token}`)

    for (const response of [publicProfile, ownProfile]) {
      assert.equal(response.status, 200)
      assert.equal(response.body.id, id)
      assert.equal('password' in response.body, false)
      assert.equal('password_hash' in response.body, false)
    }
  })

  it('protege consultas con autorización ausente, malformada, falsa o adulterada', async () => {
    const registration = await registerUser(emailFor('seguridad'))
    const token = registration.body.token
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
    const headers = [
      undefined,
      'Basic credenciales',
      'Bearer',
      'Bearer token-falso',
      `Bearer ${tamperedToken}`,
    ]

    for (const authorization of headers) {
      const requestWithHeader = api.get('/api/auth/perfil')
      if (authorization !== undefined) requestWithHeader.set('Authorization', authorization)
      const response = await requestWithHeader
      assert.equal(response.status, 401, authorization ?? 'sin encabezado')
    }
  })

  it('simula cierre de sesión eliminando el token y bloquea la siguiente consulta', async () => {
    const registration = await registerUser(emailFor('logout'))
    const session = { token: registration.body.token }

    const beforeLogout = await api.get('/api/auth/perfil').set('Authorization', `Bearer ${session.token}`)
    assert.equal(beforeLogout.status, 200)

    session.token = null
    const afterLogout = await api.get('/api/auth/perfil')
    assert.equal(afterLogout.status, 401)
    assert.equal(afterLogout.body.mensaje, 'Se requiere autenticación')
  })

  it('permite un solo registro cuando llegan dos altas simultáneas con el mismo email', async () => {
    const email = emailFor('concurrencia')
    const responses = await Promise.all([
      api.post('/api/auth/register').send({ nombre: 'Carrera A', email, password }),
      api.post('/api/auth/register').send({ nombre: 'Carrera B', email: ` ${email.toUpperCase()} `, password }),
    ])

    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409])
    const result = await query('SELECT COUNT(*)::int AS count FROM usuarios WHERE email = $1', [email])
    assert.equal(result.rows[0].count, 1)
  })
})

after(async () => {
  if (createdEmails.size > 0) {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)])
  }
  await pool.end()
})