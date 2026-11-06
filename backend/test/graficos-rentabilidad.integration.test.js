import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const emails = new Set()
const runId = randomUUID()
let sequence = 0

async function crearComisionista() {
  const email = `qa-grafico-${runId}-${++sequence}@example.test`
  emails.add(email)
  const dni = String(Number.parseInt(runId.replaceAll('-', '').slice(0, 8), 16) + sequence)
  const { rows: [usuario] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol)
     VALUES ('Gráfico', 'Prueba', $1, $2, 'solo-test', 'comisionista') RETURNING id`, [email, dni],
  )
  const token = jwt.sign({ id: usuario.id, email, rol: 'comisionista' }, process.env.JWT_SECRET, { expiresIn: '1h' })
  return { id: usuario.id, token }
}

function auth(usuario) { return { Authorization: `Bearer ${usuario.token}` } }

describe('US51: API de gráficos de rentabilidad', () => {
  afterEach(async () => {
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  it('agrupa movimientos por día, semana y mes; separa los generales y aísla viajes/usuarios', async () => {
    const propietario = await crearComisionista()
    const ajeno = await crearComisionista()
    const viaje = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, estado)
       VALUES ($1, 'Córdoba', 'Alta Gracia', '2026-11-03', 'finalizado') RETURNING id`, [propietario.id],
    )
    const cancelado = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, estado)
       VALUES ($1, 'Córdoba', 'Mendoza', '2026-11-04', 'cancelado') RETURNING id`, [propietario.id],
    )
    const viajeAjeno = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, estado)
       VALUES ($1, 'Córdoba', 'Rosario', '2026-11-03', 'finalizado') RETURNING id`, [ajeno.id],
    )
    const tipo = await query("INSERT INTO tipos_gasto (usuario_id, nombre) VALUES ($1, 'Combustible QA') RETURNING id", [propietario.id])
    await query(
      `INSERT INTO ingresos (usuario_id, viaje_id, concepto, monto, fecha, estado) VALUES
       ($1,$2,'Pasaje',100,'2026-11-03','activo'),
       ($1,NULL,'Otro ingreso',50,'2026-11-03','activo'),
       ($3,$4,'Ingreso ajeno',700,'2026-11-03','activo')`,
      [propietario.id, viaje.rows[0].id, ajeno.id, viajeAjeno.rows[0].id],
    )
    await query(
      `INSERT INTO gastos (usuario_id, tipo_gasto_id, viaje_id, monto, fecha, descripcion) VALUES
       ($1,$2,$3,25,'2026-11-03','Gasto del viaje'),
       ($1,$2,NULL,10,'2026-11-05','Gasto general')`,
      [propietario.id, tipo.rows[0].id, viaje.rows[0].id],
    )

    const base = '/api/finanzas/graficos-rentabilidad'
    const queryBase = '?desde=2026-11-01&hasta=2026-11-30'
    assert.equal((await api.get(`${base}/periodos${queryBase}&agrupacion=trimestre`).set(auth(propietario))).status, 400)
    assert.equal((await api.get(`${base}/periodos?desde=2026-11-01&hasta=2026-11-30&agrupacion=dia`)
      .set(auth(propietario))).status, 200)
    const diario = await api.get(`${base}/periodos?desde=2026-11-01&hasta=2026-11-30&agrupacion=dia`).set(auth(propietario))
    assert.equal(diario.body.periodos.length, 2)
    assert.equal(diario.body.periodos[0].periodo, '2026-11-03')
    assert.equal(diario.body.periodos[0].total_ingresos, '150.00')
    assert.equal(diario.body.periodos[0].total_gastos, '25.00')
    assert.equal(diario.body.periodos[0].resultado_economico, '125.00')
    assert.equal(diario.body.periodos[1].periodo, '2026-11-05')
    const semanal = await api.get(`${base}/periodos${queryBase}&agrupacion=semana`).set(auth(propietario))
    assert.equal(semanal.body.agrupacion, 'semana')
    assert.equal(semanal.body.periodos.length, 1)
    assert.equal(semanal.body.periodos[0].resultado_economico, '115.00')
    const mensual = await api.get(`${base}/periodos${queryBase}&agrupacion=mes`).set(auth(propietario))
    assert.equal(mensual.body.periodos[0].total_ingresos, '150.00')
    assert.equal(mensual.body.periodos[0].total_gastos, '35.00')

    const porViaje = await api.get(`${base}/viajes${queryBase}`).set(auth(propietario))
    assert.equal(porViaje.status, 200, JSON.stringify(porViaje.body))
    assert.deepEqual(porViaje.body.viajes.map((v) => v.viaje_id), [viaje.rows[0].id])
    assert.equal(porViaje.body.viajes[0].total_ingresos, '100.00')
    assert.equal(porViaje.body.viajes[0].total_gastos, '25.00')
    assert.equal(porViaje.body.viajes[0].resultado_economico, '75.00')
    assert.equal(porViaje.body.movimientos_generales.total_ingresos, '50.00')
    assert.equal(porViaje.body.movimientos_generales.total_gastos, '10.00')
    assert.equal((await api.get(`${base}/viajes${queryBase}`).set(auth(ajeno))).body.viajes.length, 1)
    assert.equal((await api.get(`${base}/periodos${queryBase}`)).status, 401)
  })
})
