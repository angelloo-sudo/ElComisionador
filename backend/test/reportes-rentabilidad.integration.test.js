import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const prefijo = `qa-us50-${randomUUID()}-`
const emails = new Set()
const password = 'ClaveSegura-2026!'
let secuencia = 0

async function registrar(rol) {
  const email = `${prefijo}${rol}-${++secuencia}@example.test`
  emails.add(email)
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const response = await api.post(`/api/auth/${ruta}`).send({
    nombre: 'Usuario QA', apellido: 'Historial', email, password, confirmarPassword: password,
    dni: String(12000000 + Math.floor(Math.random() * 70000000)), telefono: String(3510000000 + secuencia),
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

const auth = (usuario) => ({ Authorization: `Bearer ${usuario.token}` })
after(async () => { await pool.end() })

describe('US50: historial y detalle de reportes de rentabilidad', () => {
  before(async (context) => {
    const { rows } = await query("SELECT to_regclass('public.reportes_rentabilidad') AS tabla")
    if (!rows[0].tabla) context.skip('schema.sql todavía no fue aplicado en la base de pruebas')
  })
  afterEach(async () => {
    if (emails.size) await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('lista y consulta únicamente reportes propios y conserva el snapshot tras cambios operativos', async () => {
    const mio = await registrar('comisionista')
    const ajeno = await registrar('comisionista')
    const cliente = await registrar('cliente')
    const tipo = (await query('INSERT INTO tipos_gasto (usuario_id, nombre) VALUES ($1, $2) RETURNING id', [mio.usuario.id, 'QA historial'])).rows[0]
    const viaje1 = (await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, cupo_total)
       VALUES ($1, 'Córdoba', 'Villa María', '2026-11-02', 4) RETURNING id`, [mio.usuario.id],
    )).rows[0]
    const viaje2 = (await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, cupo_total)
       VALUES ($1, 'Córdoba', 'Río Cuarto', '2026-11-03', 4) RETURNING id`, [mio.usuario.id],
    )).rows[0]

    const ingresos = await query(
      `INSERT INTO ingresos (usuario_id, viaje_id, concepto, monto, fecha, estado) VALUES
        ($1, $2, 'Viaje rentable', 500.00, '2026-11-02', 'activo'),
        ($1, $3, 'Viaje con pérdida', 50.00, '2026-11-03', 'activo'),
        ($1, NULL, 'Ingreso general', 25.00, '2026-11-04', 'activo') RETURNING id`,
      [mio.usuario.id, viaje1.id, viaje2.id],
    )
    const gastos = await query(
      `INSERT INTO gastos (usuario_id, viaje_id, tipo_gasto_id, monto, fecha, descripcion) VALUES
        ($1, $2, $4, 300.00, '2026-11-02', 'Combustible'),
        ($1, $3, $4, 70.00, '2026-11-03', 'Peajes'),
        ($1, NULL, $4, 25.00, '2026-11-04', 'Mantenimiento general') RETURNING id`,
      [mio.usuario.id, viaje1.id, viaje2.id, tipo.id],
    )

    const generado = await api.get('/api/finanzas/rentabilidad?desde=2026-11-01&hasta=2026-11-30').set(auth(mio))
    assert.equal(generado.status, 200, JSON.stringify(generado.body))
    assert.ok(generado.body.id)
    assert.equal(generado.body.total_ingresos, '575.00')
    assert.equal(generado.body.total_gastos, '395.00')
    assert.equal(generado.body.resultado_economico, '180.00')
    assert.deepEqual(generado.body.trayectos.map((v) => v.clasificacion), ['rentable', 'perdida'])
    assert.equal(generado.body.movimientos_generales.ingresos.length, 1)
    assert.equal(generado.body.movimientos_generales.gastos.length, 1)

    const lista = await api.get('/api/finanzas/reportes-rentabilidad').set(auth(mio))
    assert.equal(lista.status, 200, JSON.stringify(lista.body))
    assert.equal(lista.body.paginacion.total, 1)
    assert.equal(String(lista.body.reportes[0].id), String(generado.body.id))
    assert.equal(lista.body.reportes[0].resultado_economico, '180.00')

    await query('UPDATE ingresos SET monto = 9999 WHERE id = $1', [ingresos.rows[0].id])
    await query('DELETE FROM gastos WHERE id = $1', [gastos.rows[0].id])
    const detalle = await api.get(`/api/finanzas/reportes-rentabilidad/${generado.body.id}`).set(auth(mio))
    assert.equal(detalle.status, 200, JSON.stringify(detalle.body))
    assert.equal(detalle.body.total_ingresos, '575.00')
    assert.equal(detalle.body.total_gastos, '395.00')
    assert.equal(detalle.body.ingresos.find((m) => m.id === ingresos.rows[0].id).monto, '500.00')
    assert.equal(detalle.body.gastos.find((m) => m.id === gastos.rows[0].id).monto, '300.00')

    assert.equal((await api.get(`/api/finanzas/reportes-rentabilidad/${generado.body.id}`).set(auth(ajeno))).status, 404)
    assert.equal((await api.get(`/api/finanzas/reportes-rentabilidad/${generado.body.id}`).set(auth(cliente))).status, 403)
    assert.equal((await api.get('/api/finanzas/reportes-rentabilidad/abc').set(auth(mio))).status, 400)
    assert.equal((await api.get('/api/finanzas/reportes-rentabilidad/2147483647').set(auth(mio))).status, 404)
    assert.equal((await api.get('/api/finanzas/reportes-rentabilidad?limite=101').set(auth(mio))).status, 400)
  })

  it('filtra por el período analizado completo, incluye los extremos y mantiene el aislamiento', async () => {
    const mio = await registrar('comisionista')
    const ajeno = await registrar('comisionista')
    const cliente = await registrar('cliente')
    const periodosMios = [
      ['2026-11-01', '2026-11-30'], // Igual a ambos límites.
      ['2026-11-10', '2026-11-20'], // Contenido en el filtro.
      ['2026-10-31', '2026-11-10'], // Se extiende antes del filtro.
      ['2026-11-20', '2026-12-01'], // Se extiende después del filtro.
      ['2026-11-06', '2026-11-06'], // Rango de un día.
    ]
    const idsMios = []
    for (const [desde, hasta] of periodosMios) {
      const creado = await query(
        `INSERT INTO reportes_rentabilidad
           (usuario_id, periodo_desde, periodo_hasta, total_ingresos, total_gastos,
            resultado_economico, version_snapshot, datos_snapshot)
         VALUES ($1, $2, $3, 100, 50, 50, 1, '{"ingresos":[],"gastos":[]}'::jsonb)
         RETURNING id`,
        [mio.usuario.id, desde, hasta],
      )
      idsMios.push(String(creado.rows[0].id))
    }
    await query(
      `INSERT INTO reportes_rentabilidad
         (usuario_id, periodo_desde, periodo_hasta, total_ingresos, total_gastos,
          resultado_economico, version_snapshot, datos_snapshot)
       VALUES ($1, '2026-11-01', '2026-11-30', 900, 100, 800, 1, '{"ingresos":[],"gastos":[]}'::jsonb)`,
      [ajeno.usuario.id],
    )

    const base = '/api/finanzas/reportes-rentabilidad'
    assert.equal((await api.get(base)).status, 401)
    assert.equal((await api.get(base).set(auth(cliente))).status, 403)
    assert.equal((await api.get(`${base}?fechaInicio=2026-11-01` ).set(auth(mio))).status, 400)
    assert.equal((await api.get(`${base}?fechaFin=2026-11-30`).set(auth(mio))).status, 400)
    assert.equal((await api.get(`${base}?fechaInicio=2026-02-30&fechaFin=2026-03-01`).set(auth(mio))).status, 400)
    assert.equal((await api.get(`${base}?fechaInicio=2026-12-01&fechaFin=2026-11-30`).set(auth(mio))).status, 400)

    const rango = await api.get(`${base}?fechaInicio=2026-11-01&fechaFin=2026-11-30&limite=100`).set(auth(mio))
    assert.equal(rango.status, 200, JSON.stringify(rango.body))
    assert.deepEqual(
      rango.body.reportes.map((reporte) => String(reporte.id)).sort(),
      [idsMios[0], idsMios[1], idsMios[4]].sort(),
    )
    assert.equal(rango.body.paginacion.total, 3)

    const mismoDia = await api.get(`${base}?fechaInicio=2026-11-06&fechaFin=2026-11-06`).set(auth(mio))
    assert.equal(mismoDia.status, 200)
    assert.deepEqual(mismoDia.body.reportes.map((reporte) => String(reporte.id)), [idsMios[4]])

    const sinCoincidencias = await api.get(`${base}?fechaInicio=2026-12-01&fechaFin=2026-12-31`).set(auth(mio))
    assert.equal(sinCoincidencias.status, 200)
    assert.deepEqual(sinCoincidencias.body.reportes, [])

    const sinFiltros = await api.get(`${base}?fechaInicio=&fechaFin=&limite=100`).set(auth(mio))
    assert.equal(sinFiltros.status, 200)
    assert.equal(sinFiltros.body.paginacion.total, periodosMios.length)
    assert.equal(sinFiltros.body.reportes.some((reporte) => String(reporte.id) === idsMios[0]), true)
  })
})
