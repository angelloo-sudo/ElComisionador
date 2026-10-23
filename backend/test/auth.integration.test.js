import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { createHash, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const testRunId = randomUUID()
const emailPrefix = `qa-auth-${testRunId}-`
const password = 'ClaveSegura-2026!'
const createdEmails = new Set()
let contactSequence = Date.now() % 10000000

function emailFor(suffix = randomUUID()) {
  const email = `${emailPrefix}${suffix}@example.test`
  createdEmails.add(email)
  return email
}

async function registerUser(email = emailFor()) {
  const response = await api.post('/api/auth/register').send(registrationData(email))

  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.equal(response.body.email, email)
  assert.equal('token' in response.body, false)
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  assert.ok(login.body.token)
  assert.ok(login.body.usuario?.id)
  return login
}

function registrationData(email, overrides = {}) {
  contactSequence += 1
  return {
    nombre: 'Ana Cliente',
    apellido: 'Prueba',
    email,
    password,
    confirmarPassword: password,
    dni: String(10000000 + (contactSequence % 89999999)),
    telefono: `351${String(1000000 + (contactSequence % 8999999))}`,
    ...overrides,
  }
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
    const datos = registrationData(`  ${email.toUpperCase()}  `, {
      nombre: '  Ana Cliente  ',
    })
    const response = await api.post('/api/auth/register').send(datos)

    assert.equal(response.status, 201)
    assert.equal(response.body.email, email)
    assert.equal('token' in response.body, false)
    const account = await query('SELECT id, nombre, rol, dni, email_verificado, password_hash FROM usuarios WHERE email = $1', [email])
    assert.equal(account.rows.length, 1)
    assert.equal(account.rows[0].nombre, 'Ana Cliente')
    assert.equal(account.rows[0].rol, 'cliente')
    assert.equal(account.rows[0].dni, datos.dni)
    assert.equal(account.rows[0].email_verificado, false)
    assert.notEqual(account.rows[0].password_hash, password)
  })

  it('verifica una cuenta pendiente y habilita el login con un token de correo valido', async () => {
    const email = emailFor('verificacion')
    const registration = await api.post('/api/auth/register').send(registrationData(email))
    assert.equal(registration.status, 201)
    assert.equal(registration.body.verificacionEnviada, false)
    const account = await query('SELECT id, dni, email_verificado FROM usuarios WHERE email = $1', [email])
    assert.equal(account.rows[0].email_verificado, false)
    const beforeVerification = await api.post('/api/auth/login').send({ email, password })
    assert.equal(beforeVerification.status, 403)
    assert.equal(beforeVerification.body.codigo, 'EMAIL_NO_VERIFICADO')
    const token = jwt.sign({ sub: String(account.rows[0].dni), email, rol: 'cliente', tipo: 'verificacion_email' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    const verification = await api.post('/api/auth/verificar-email').send({ token })
    assert.equal(verification.status, 200, JSON.stringify(verification.body))
    assert.match(verification.body.mensaje, /verificado/i)
    const state = await query('SELECT email_verificado FROM usuarios WHERE email = $1', [email])
    assert.equal(state.rows[0].email_verificado, true)
    assert.equal((await api.post('/api/auth/login').send({ email, password })).status, 200)
  })

  it('restablece una contrase?a con token de un solo uso e invalida la anterior', async () => {
    const email = emailFor('recuperacion')
    const passwordHash = await bcrypt.hash(password, 10)
    await query(`INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, email_verificado)
      VALUES ('Ana Cliente', 'Prueba', $1, $2, 'cliente', true)`, [email, passwordHash])
    const token = randomUUID() + randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await query("UPDATE usuarios SET reset_token = $1, reset_token_expira = NOW() + INTERVAL '1 hour' WHERE email = $2", [tokenHash, email])
    const reset = await api.post('/api/auth/restablecer').send({ token, password: 'NuevaClave-2026!' })
    assert.equal(reset.status, 200, JSON.stringify(reset.body))
    assert.match(reset.body.mensaje, /actualizada correctamente/i)
    const consumed = await query('SELECT reset_token, reset_token_expira FROM usuarios WHERE email = $1', [email])
    assert.equal(consumed.rows[0].reset_token, null)
    assert.equal(consumed.rows[0].reset_token_expira, null)
    assert.equal((await api.post('/api/auth/restablecer').send({ token, password: 'OtraClave-2026!' })).status, 400)
    assert.equal((await api.post('/api/auth/login').send({ email, password })).status, 401)
    assert.equal((await api.post('/api/auth/login').send({ email, password: 'NuevaClave-2026!' })).status, 200)
  })

  it('rechaza registro duplicado aunque cambien mayúsculas o espacios', async () => {
    const email = emailFor('duplicado')
    await registerUser(email)

    const response = await api.post('/api/auth/register').send(registrationData(`  ${email.toUpperCase()} `, {
      nombre: 'Segundo Registro',
    }))

    assert.equal(response.status, 409)
    assert.equal(response.body.mensaje, 'El email ya está registrado')
  })

  it('rechaza credenciales inválidas y entradas de registro incompletas', async () => {
    const email = emailFor('validacion')
    const base = registrationData(email)
    const invalidRequests = [
      { ...base, nombre: '' },
      { ...base, email: '' },
      { ...base, password: '12345', confirmarPassword: '12345' },
      { ...base, confirmarPassword: 'OtraClave-2026!' },
      { ...base, telefono: '' },
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
    assert.ok(response.body.usuario.dni)
    assert.equal('password_hash' in response.body.usuario, false)
    assert.ok(response.body.token)
    assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).sub, response.body.usuario.dni)
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
    const ownProfile = await api.get('/api/auth/perfil').set('Authorization', `Bearer ${registration.body.token}`)

    assert.equal(ownProfile.status, 200)
    assert.equal(ownProfile.body.id, id)
    assert.equal('password' in ownProfile.body, false)
    assert.equal('password_hash' in ownProfile.body, false)
    const obsoletePublicProfile = await api.get(`/api/auth/perfil/${id}`)
    assert.equal(obsoletePublicProfile.status, 404)
  })

  it('actualiza nombre, apellido y teléfono del cliente conservando email y DNI', async () => {
    const session = await registerUser(emailFor('perfil-modificable'))
    const userId = session.body.usuario.id
    const before = await query(
      `SELECT u.email, c.dni FROM usuarios u JOIN clientes c ON c.usuario_id = u.id WHERE u.id = $1`,
      [userId],
    )
    const response = await api.put('/api/auth/perfil')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ nombre: 'Maria', apellido: 'Actualizada', telefono: '3517654321' })

    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.usuario.nombre, 'Maria')
    assert.equal(response.body.usuario.apellido, 'Actualizada')
    assert.equal(response.body.usuario.telefono, '3517654321')
    const after = await query(
      `SELECT u.email, c.dni FROM usuarios u JOIN clientes c ON c.usuario_id = u.id WHERE u.id = $1`,
      [userId],
    )
    assert.deepEqual(after.rows, before.rows)
  })

  it('rechaza cambios de email o DNI y valida campos obligatorios del perfil cliente', async () => {
    const session = await registerUser(emailFor('perfil-inmutable'))
    const userId = session.body.usuario.id
    const before = await query(
      `SELECT u.nombre, u.apellido, u.email, c.dni, c.telefono
       FROM usuarios u JOIN clientes c ON c.usuario_id = u.id WHERE u.id = $1`,
      [userId],
    )
    const forbidden = await api.put('/api/auth/perfil')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ nombre: 'Maria', apellido: 'Actualizada', telefono: '3517654321', email: 'nuevo@example.test', dni: '12345678' })
    assert.equal(forbidden.status, 400)

    const invalidPhone = await api.put('/api/auth/perfil')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ nombre: 'Maria', apellido: 'Actualizada', telefono: 'bad' })
    assert.equal(invalidPhone.status, 400)
    const missingSurname = await api.put('/api/auth/perfil')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ nombre: 'Maria', apellido: '', telefono: '3517654321' })
    assert.equal(missingSurname.status, 400)

    const after = await query(
      `SELECT u.nombre, u.apellido, u.email, c.dni, c.telefono
       FROM usuarios u JOIN clientes c ON c.usuario_id = u.id WHERE u.id = $1`,
      [userId],
    )
    assert.deepEqual(after.rows, before.rows)
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
      api.post('/api/auth/register').send(registrationData(email, { nombre: 'Carrera A' })),
      api.post('/api/auth/register').send(registrationData(` ${email.toUpperCase()} `, { nombre: 'Carrera B' })),
    ])

    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409])
    const result = await query('SELECT COUNT(*)::int AS count FROM usuarios WHERE email = $1', [email])
    assert.equal(result.rows[0].count, 1)
  })
  it('registra un comisionista con foto y presentación y persiste su rol fijo', async () => {
    const email = emailFor('comisionista')
    const body = registrationData(email, {
      nombre: 'Ana Comisionista', presentacion: 'Traslados en Córdoba.',
      foto_perfil: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', rol: 'administrador',
    })
    const response = await api.post('/api/auth/register-comisionista').send(body)
    assert.equal(response.status, 201, JSON.stringify(response.body))
    const profile = await query(
      `SELECT u.rol, m.presentacion, m.foto_perfil FROM usuarios u JOIN comisionistas m ON m.usuario_id = u.id WHERE u.email = $1`,
      [email],
    )
    assert.equal(profile.rows[0].rol, 'comisionista')
    assert.equal(profile.rows[0].presentacion, body.presentacion)
    assert.equal(profile.rows[0].foto_perfil, body.foto_perfil)
    const invalidPhoto = await api.post('/api/auth/register-comisionista').send(registrationData(emailFor('foto-invalida'), {
      nombre: 'Ana Comisionista', foto_perfil: 'data:image/jpeg;base64,invalida',
    }))
    assert.equal(invalidPhoto.status, 400)
    const invalidPresentation = await api.post('/api/auth/register-comisionista').send(registrationData(emailFor('presentacion-invalida'), {
      nombre: 'Ana Comisionista', presentacion: 'x'.repeat(501),
    }))
    assert.equal(invalidPresentation.status, 400)
  })

  it('rechaza cambiar email o DNI del comisionista sin alterar datos', async () => {
    const email = emailFor('comisionista-inmutable')
    const data = registrationData(email, { nombre: 'Ana Comisionista' })
    assert.equal((await api.post('/api/auth/register-comisionista').send(data)).status, 201)
    await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
    const login = await api.post('/api/auth/login').send({ email, password })
    assert.equal(login.status, 200)
    const before = await query('SELECT u.email, m.dni FROM usuarios u JOIN comisionistas m ON m.usuario_id = u.id WHERE u.email = $1', [email])
    const response = await api.put('/api/auth/perfil').set('Authorization', `Bearer ${login.body.token}`).send({
      nombre: 'Maria', apellido: 'Actualizada', telefono: '3517654321', email: 'otro@example.test', dni: '12345678',
    })
    assert.equal(response.status, 400)
    const after = await query('SELECT u.email, m.dni FROM usuarios u JOIN comisionistas m ON m.usuario_id = u.id WHERE u.email = $1', [email])
    assert.deepEqual(after.rows, before.rows)
  })

  it('elimina los viajes y encomiendas del comisionista al dar de baja su cuenta', async () => {
    const email = emailFor('comisionista-baja')
    const registration = await api.post('/api/auth/register-comisionista').send(registrationData(email, { nombre: 'Ana Comisionista' }))
    assert.equal(registration.status, 201)
    await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
    const login = await api.post('/api/auth/login').send({ email, password })
    const userId = login.body.usuario.id
    const trip = await query(`INSERT INTO viajes (usuario_id, origen, destino, fecha) VALUES ($1, 'Córdoba', 'Carlos Paz', CURRENT_DATE + 1) RETURNING id`, [userId])
    const shipment = await query(`INSERT INTO encomiendas (viaje_id, destinatario_nombre) VALUES ($1, 'Destinatario QA') RETURNING id`, [trip.rows[0].id])
    const baja = await api.delete('/api/auth/perfil').set('Authorization', `Bearer ${login.body.token}`)
    assert.equal(baja.status, 200, JSON.stringify(baja.body))
    assert.equal((await query('SELECT id FROM usuarios WHERE id = $1', [userId])).rows.length, 0)
    assert.equal((await query('SELECT id FROM viajes WHERE id = $1', [trip.rows[0].id])).rows.length, 0)
    assert.equal((await query('SELECT id FROM encomiendas WHERE id = $1', [shipment.rows[0].id])).rows.length, 0)
    const relogin = await api.post('/api/auth/login').send({ email, password })
    assert.equal(relogin.status, 401)
  })
})

after(async () => {
  if (createdEmails.size > 0) {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)])
  }
  await pool.end()
})