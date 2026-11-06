import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const prefijo = `qa-renta-${randomUUID()}-`
const emails = new Set()
const password = 'ClaveSegura-2026!'
let secuencia = 0

async function registrar(rol) {
  const email = `${prefijo}${rol}-${++secuencia}@example.test`
  emails.add(email)
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const registro = await api.post(`/api/auth/${ruta}`).send({
    nombre: 'Usuario QA', apellido: 'Rentabilidad', email, password, confirmarPassword: password,
    dni: String(12000000 + Math.floor(Math.random() * 70000000)), telefono: String(3510000000 + secuencia),
  })
  assert.equal(registro.status, 201, JSON.stringify(registro.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

const auth = (usuario) => ({ Authorization: `Bearer ${usuario.token}` })

after(async () => { await pool.end() })

describe('GET /api/finanzas/rentabilidad (US49)', () => {
  before(async (context) => {
    const { rows } = await query("SELECT to_regclass('public.reportes_rentabilidad') AS tabla")
    if (!rows[0].tabla) context.skip('schema.sql todavía no fue aplicado en la base de pruebas')
  })

  afterEach(async () => {
    if (emails.size) await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('valida autenticación, rol y período', async () => {
    assert.equal((await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-30')).status, 401)
    const cliente = await registrar('cliente')
    assert.equal((await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-30').set(auth(cliente))).status, 403)
    const comisionista = await registrar('comisionista')
    const base = '/api/finanzas/rentabilidad'
    assert.equal((await api.get(`${base}?desde=2026-02-31&hasta=2026-03-01`).set(auth(comisionista))).status, 400)
    assert.equal((await api.get(`${base}?desde=2026-11-02&hasta=2026-11-01`).set(auth(comisionista))).status, 400)
    assert.equal((await api.get(`${base}?desde=2026-11-01`).set(auth(comisionista))).status, 400)
  })

  it('incluye ambos extremos, excluye anulados y a otros usuarios, y mantiene detalles y totales exactos', async () => {
    const mio = await registrar('comisionista')
    const otro = await registrar('comisionista')
    const [mioTipo] = (await query('INSERT INTO tipos_gasto (usuario_id, nombre) VALUES ($1, $2) RETURNING id', [mio.usuario.id, 'Gasto US49'])).rows
    const [otroTipo] = (await query('INSERT INTO tipos_gasto (usuario_id, nombre) VALUES ($1, $2) RETURNING id', [otro.usuario.id, 'Gasto ajeno'])).rows

    await query(
      `INSERT INTO ingresos (usuario_id, concepto, monto, fecha, estado) VALUES
        ($1, 'Ingreso inicio', 100.10, '2026-11-01', 'activo'),
        ($1, 'Ingreso fin', 50.90, '2026-11-30', 'activo'),
        ($1, 'Ingreso anulado', 500.00, '2026-11-15', 'anulado'),
        ($1, 'Ingreso fuera', 700.00, '2026-12-01', 'activo'),
        ($2, 'Ingreso ajeno', 900.00, '2026-11-15', 'activo')`,
      [mio.usuario.id, otro.usuario.id],
    )
    await query(
      `INSERT INTO gastos (usuario_id, tipo_gasto_id, monto, fecha, descripcion) VALUES
        ($1, $2, 25.25, '2026-11-01', 'Primer día'),
        ($1, $2, 25.75, '2026-11-30', 'Último día'),
        ($1, $2, 500.00, '2026-12-01', 'Fuera de período'),
        ($3, $4, 800.00, '2026-11-15', 'Ajeno')`,
      [mio.usuario.id, mioTipo.id, otro.usuario.id, otroTipo.id],
    )

    const respuesta = await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-30').set(auth(mio))
    assert.equal(respuesta.status, 200, JSON.stringify(respuesta.body))
    assert.equal(respuesta.body.total_ingresos, '151.00')
    assert.equal(respuesta.body.total_gastos, '51.00')
    assert.equal(respuesta.body.resultado_economico, '100.00')
    assert.equal(respuesta.body.cantidad_movimientos, 4)
    assert.deepEqual(respuesta.body.ingresos.map((x) => x.fecha).sort(), ['2026-11-01', '2026-11-30'])
    assert.deepEqual(respuesta.body.gastos.map((x) => x.fecha).sort(), ['2026-11-01', '2026-11-30'])
    assert.deepEqual(respuesta.body.gastos.map((x) => x.descripcion).sort(), ['Primer día', 'Último día'])

    const unDia = await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-01').set(auth(mio))
    assert.equal(unDia.status, 200)
    assert.equal(unDia.body.total_ingresos, '100.10')
    assert.equal(unDia.body.total_gastos, '25.25')
  })

  it('devuelve totales cero y detalles vacíos si no hay movimientos', async () => {
    const comisionista = await registrar('comisionista')
    const respuesta = await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-01').set(auth(comisionista))
    assert.equal(respuesta.status, 200)
    assert.equal(respuesta.body.total_ingresos, '0.00')
    assert.equal(respuesta.body.total_gastos, '0.00')
    assert.equal(respuesta.body.resultado_economico, '0.00')
    assert.deepEqual(respuesta.body.ingresos, [])
    assert.deepEqual(respuesta.body.gastos, [])
  })
})
