// Epica 7 (US40 a US48): gastos y tipos de gasto, contra la API y la base de datos reales.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { hoyEnCordoba } from '../src/services/estado-viaje.js'

const api = request(app)
const emailPrefix = `qa-gastos-${randomUUID()}-`
const password = 'ClaveSegura-2026!'
const createdEmails = new Set()
let emailSequence = 0

async function registrarYLoguear(ruta, rol, dni) {
  const email = `${emailPrefix}${rol}-${++emailSequence}@example.test`
  createdEmails.add(email)
  const registro = await api.post(ruta).send({
    nombre: 'Prueba', apellido: 'Gastos', email, password, confirmarPassword: password, dni, telefono: '3511234567',
  })
  assert.equal(registro.status, 201, JSON.stringify(registro.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

const comisionista = () => registrarYLoguear('/api/auth/register-comisionista', 'comisionista', '87654321')
const cliente = () => registrarYLoguear('/api/auth/register', 'cliente', '12345678')

const como = (sesion) => ({
  get: (url) => api.get(url).set('Authorization', `Bearer ${sesion.token}`),
  post: (url, body) => api.post(url).set('Authorization', `Bearer ${sesion.token}`).send(body),
  put: (url, body) => api.put(url).set('Authorization', `Bearer ${sesion.token}`).send(body),
  delete: (url) => api.delete(url).set('Authorization', `Bearer ${sesion.token}`),
  patch: (url, body) => api.patch(url).set('Authorization', `Bearer ${sesion.token}`).send(body ?? {}),
})

const HOY = hoyEnCordoba()

async function crearTipo(usuario, nombre = 'Combustible', descripcion) {
  const res = await como(usuario).post('/api/finanzas/tipos-gasto', { nombre, descripcion })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body
}

async function crearGasto(usuario, tipo, datos = {}) {
  const res = await como(usuario).post('/api/finanzas/gastos', { tipo_gasto_id: tipo.id, monto: 15000, fecha: HOY, ...datos })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body
}

describe('Épica 7: gastos y tipos de gasto (ABMC)', () => {
  before(async () => { await query('SELECT 1') })

  afterEach(async () => {
    if (createdEmails.size === 0) return
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(createdEmails)]) // cascada
    createdEmails.clear()
  })

  after(async () => { await pool.end() })

  it('exige sesión y rol de comisionista en todas las rutas', async () => {
    const rutas = [
      ['get', '/api/finanzas/gastos'], ['post', '/api/finanzas/gastos'], ['get', '/api/finanzas/gastos/1'],
      ['put', '/api/finanzas/gastos/1'], ['patch', '/api/finanzas/gastos/1/tipo'], ['delete', '/api/finanzas/gastos/1'],
      ['get', '/api/finanzas/tipos-gasto'], ['post', '/api/finanzas/tipos-gasto'], ['get', '/api/finanzas/tipos-gasto/1'],
      ['put', '/api/finanzas/tipos-gasto/1'], ['delete', '/api/finanzas/tipos-gasto/1'],
    ]
    const unCliente = await cliente()
    for (const [metodo, url] of rutas) {
      assert.equal((await api[metodo](url).send({})).status, 401, `${metodo} ${url} sin sesión`)
      assert.equal((await api[metodo](url).set('Authorization', `Bearer ${unCliente.token}`).send({})).status, 403, `${metodo} ${url} como cliente`)
    }
  })

  describe('US45 - Registrar tipo de gasto', () => {
    it('crea el tipo y normaliza el nombre', async () => {
      const yo = await comisionista()
      const res = await como(yo).post('/api/finanzas/tipos-gasto', { nombre: '  Peajes   y tasas ', descripcion: 'Autopistas' })
      assert.equal(res.status, 201, JSON.stringify(res.body))
      assert.equal(res.body.nombre, 'Peajes y tasas')
      assert.equal(res.body.descripcion, 'Autopistas')
      assert.equal(res.body.cantidad_gastos, 0)
    })

    it('rechaza datos inválidos', async () => {
      const yo = await comisionista()
      const res = await como(yo).post('/api/finanzas/tipos-gasto', { nombre: 'ab', descripcion: 'x'.repeat(201) })
      assert.equal(res.status, 400)
      assert.equal(res.body.errores.length, 2)
    })

    it('no repite el nombre (sin distinguir mayúsculas) ni con pedidos simultáneos; otro comisionista sí puede usarlo', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      await crearTipo(yo, 'Combustible')
      assert.equal((await como(yo).post('/api/finanzas/tipos-gasto', { nombre: 'COMBUSTIBLE' })).status, 409)
      await crearTipo(otro, 'Combustible')
      const rs = await Promise.all([1, 2, 3].map(() => como(yo).post('/api/finanzas/tipos-gasto', { nombre: 'Simultaneo' })))
      assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409, 409])
    })
  })

  describe('US47 - Consultar tipos de gasto', () => {
    it('lista solo los propios, ordenados, con cantidad de gastos, y filtra por nombre', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const peajes = await crearTipo(yo, 'Peajes')
      await crearTipo(yo, 'Combustible')
      await crearTipo(otro, 'Ajeno')
      await crearGasto(yo, peajes)
      await crearGasto(yo, peajes)

      const res = await como(yo).get('/api/finanzas/tipos-gasto')
      assert.deepEqual(res.body.map((t) => [t.nombre, t.cantidad_gastos]), [['Combustible', 0], ['Peajes', 2]])
      assert.deepEqual((await como(yo).get('/api/finanzas/tipos-gasto?q=PEA')).body.map((t) => t.nombre), ['Peajes'])
      assert.deepEqual((await como(yo).get('/api/finanzas/tipos-gasto?q=%25')).body, []) // % literal
    })

    it('consulta uno por id; ajeno, inexistente o inválido no se puede', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const mio = await crearTipo(yo, 'Mio')
      assert.equal((await como(yo).get(`/api/finanzas/tipos-gasto/${mio.id}`)).status, 200)
      assert.equal((await como(otro).get(`/api/finanzas/tipos-gasto/${mio.id}`)).status, 404)
      assert.equal((await como(yo).get('/api/finanzas/tipos-gasto/abc')).status, 400)
      assert.equal((await como(yo).get('/api/finanzas/tipos-gasto/99999999999')).status, 400)
      assert.equal((await como(yo).get('/api/finanzas/tipos-gasto/2147483647')).status, 404)
    })
  })

  describe('US46 - Modificar tipo de gasto', () => {
    it('actualiza nombre y descripción y los gastos siguen asociados con el nombre nuevo', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Combustible')
      const g = await crearGasto(yo, tipo)
      const res = await como(yo).put(`/api/finanzas/tipos-gasto/${tipo.id}`, { nombre: 'Nafta y GNC', descripcion: 'Carga' })
      assert.equal(res.status, 200, JSON.stringify(res.body))
      assert.equal(res.body.nombre, 'Nafta y GNC')
      assert.equal(res.body.cantidad_gastos, 1)
      assert.equal((await como(yo).get(`/api/finanzas/gastos/${g.id}`)).body.tipo_nombre, 'Nafta y GNC')
    })

    it('permite su mismo nombre, rechaza el de otro tipo propio, valida y no toca tipos ajenos', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const a = await crearTipo(yo, 'Alfa')
      await crearTipo(yo, 'Beta')
      assert.equal((await como(yo).put(`/api/finanzas/tipos-gasto/${a.id}`, { nombre: 'alfa', descripcion: 'nueva' })).status, 200)
      assert.equal((await como(yo).put(`/api/finanzas/tipos-gasto/${a.id}`, { nombre: 'BETA' })).status, 409)
      assert.equal((await como(yo).put(`/api/finanzas/tipos-gasto/${a.id}`, { nombre: '' })).status, 400)
      assert.equal((await como(otro).put(`/api/finanzas/tipos-gasto/${a.id}`, { nombre: 'Hackeado' })).status, 404)
      assert.equal((await como(yo).put('/api/finanzas/tipos-gasto/abc', { nombre: 'Gamma' })).status, 400)
    })
  })

  describe('US48 - Eliminar tipo de gasto', () => {
    it('elimina un tipo sin gastos y su nombre queda libre', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Lavado')
      assert.equal((await como(yo).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 204)
      assert.equal((await como(yo).get(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 404)
      await crearTipo(yo, 'Lavado')
    })

    it('no elimina un tipo con gastos asociados; sí cuando se eliminan los gastos', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Seguro')
      const g = await crearGasto(yo, tipo)
      const res = await como(yo).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)
      assert.equal(res.status, 409)
      assert.match(res.body.mensaje, /1 gasto asociado/)
      assert.equal((await como(yo).get(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 200)
      await como(yo).delete(`/api/finanzas/gastos/${g.id}`)
      assert.equal((await como(yo).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 204)
    })

    it('no elimina tipos ajenos, inexistentes ni ids inválidos', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const tipo = await crearTipo(yo, 'Seguro')
      assert.equal((await como(otro).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 404)
      assert.equal((await como(yo).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 204)
      assert.equal((await como(yo).delete(`/api/finanzas/tipos-gasto/${tipo.id}`)).status, 404)
      assert.equal((await como(yo).delete('/api/finanzas/tipos-gasto/xyz')).status, 400)
    })
  })

  describe('US40 - Registrar gasto (el tipo de gasto es el concepto)', () => {
    it('registra el gasto con el monto exacto y el tipo como concepto', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Seguro')
      const res = await como(yo).post('/api/finanzas/gastos', { tipo_gasto_id: tipo.id, monto: '25000.5', fecha: HOY, descripcion: 'Cuota de octubre' })
      assert.equal(res.status, 201, JSON.stringify(res.body))
      assert.equal(res.body.tipo_nombre, 'Seguro')
      assert.equal(res.body.monto, '25000.50')
      assert.equal(res.body.fecha, HOY)
      assert.equal(res.body.descripcion, 'Cuota de octubre')
    })

    it('rechaza datos inválidos y no guarda nada', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Seguro')
      const base = { tipo_gasto_id: tipo.id, monto: 100, fecha: HOY }
      const casos = [
        [{ tipo_gasto_id: undefined }, /tipo de gasto/i], [{ tipo_gasto_id: null }, /tipo de gasto/i], [{ tipo_gasto_id: 'abc' }, /tipo de gasto/i],
        [{ monto: 0 }, /mayor a cero/], [{ monto: -10 }, /monto/i], [{ monto: '12.345' }, /2 decimales/], [{ monto: 'mucho' }, /monto/i], [{ monto: undefined }, /obligatorio/],
        [{ fecha: '2999-01-01' }, /posterior a hoy/], [{ fecha: '2026-02-31' }, /formato/], [{ fecha: undefined }, /obligatoria/],
        [{ descripcion: 'x'.repeat(501) }, /500/],
      ]
      for (const [cambios, esperado] of casos) {
        const res = await como(yo).post('/api/finanzas/gastos', { ...base, ...cambios })
        assert.equal(res.status, 400, JSON.stringify(cambios))
        assert.match(res.body.errores.join('|'), esperado, JSON.stringify(cambios))
      }
      assert.deepEqual((await como(yo).get('/api/finanzas/gastos')).body.gastos, [])
    })

    it('no deja usar tipos ajenos ni inexistentes', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const ajeno = await crearTipo(otro, 'Ajeno')
      for (const id of [ajeno.id, 2147483647]) {
        assert.equal((await como(yo).post('/api/finanzas/gastos', { tipo_gasto_id: id, monto: 1, fecha: HOY })).status, 400)
      }
    })
  })

  describe('US41 - Modificar gasto y US44 - Asociarlo a otro tipo', () => {
    it('actualiza tipo, monto, fecha y descripción', async () => {
      const yo = await comisionista()
      const combustible = await crearTipo(yo, 'Combustible')
      const mant = await crearTipo(yo, 'Mantenimiento')
      const g = await crearGasto(yo, combustible)
      const res = await como(yo).put(`/api/finanzas/gastos/${g.id}`, { tipo_gasto_id: mant.id, monto: '98000.00', fecha: '2026-01-15', descripcion: 'Cubiertas' })
      assert.equal(res.status, 200, JSON.stringify(res.body))
      assert.deepEqual([res.body.tipo_nombre, res.body.monto, res.body.fecha, res.body.descripcion], ['Mantenimiento', '98000.00', '2026-01-15', 'Cubiertas'])
    })

    it('PATCH /tipo cambia la asociación y valida el tipo', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const a = await crearTipo(yo, 'Alfa')
      const b = await crearTipo(yo, 'Beta')
      const ajeno = await crearTipo(otro, 'Ajeno')
      const g = await crearGasto(yo, a)
      assert.equal((await como(yo).patch(`/api/finanzas/gastos/${g.id}/tipo`, { tipo_gasto_id: b.id })).body.tipo_nombre, 'Beta')
      for (const body of [{}, { tipo_gasto_id: null }, { tipo_gasto_id: 'x' }]) {
        assert.equal((await como(yo).patch(`/api/finanzas/gastos/${g.id}/tipo`, body)).status, 400, JSON.stringify(body))
      }
      assert.equal((await como(yo).patch(`/api/finanzas/gastos/${g.id}/tipo`, { tipo_gasto_id: ajeno.id })).status, 400)
      assert.equal((await como(otro).patch(`/api/finanzas/gastos/${g.id}/tipo`, { tipo_gasto_id: ajeno.id })).status, 404)
    })

    it('valida los datos y no toca gastos ajenos', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const tipo = await crearTipo(yo, 'Combustible')
      const g = await crearGasto(yo, tipo)
      const cuerpo = { tipo_gasto_id: tipo.id, monto: 200, fecha: HOY }
      assert.equal((await como(yo).put(`/api/finanzas/gastos/${g.id}`, { ...cuerpo, monto: 0 })).status, 400)
      assert.equal((await como(otro).put(`/api/finanzas/gastos/${g.id}`, cuerpo)).status, 404)
      assert.equal((await como(yo).put('/api/finanzas/gastos/abc', cuerpo)).status, 400)
      assert.equal((await como(yo).get(`/api/finanzas/gastos/${g.id}`)).body.monto, '15000.00')
    })
  })

  describe('US42 - Eliminar gasto', () => {
    it('elimina el gasto: desaparece y deja de sumar', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Combustible')
      const g1 = await crearGasto(yo, tipo, { monto: 1000 })
      const g2 = await crearGasto(yo, tipo, { monto: 500 })
      assert.equal((await como(yo).delete(`/api/finanzas/gastos/${g1.id}`)).status, 204)
      assert.equal((await como(yo).get(`/api/finanzas/gastos/${g1.id}`)).status, 404)
      const lista = await como(yo).get('/api/finanzas/gastos')
      assert.deepEqual(lista.body.gastos.map((g) => g.id), [g2.id])
      assert.deepEqual(lista.body.resumen, { cantidad: 1, total: '500.00' })
    })

    it('no elimina gastos ajenos, inexistentes ni ids inválidos', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const g = await crearGasto(yo, await crearTipo(yo, 'Combustible'))
      assert.equal((await como(otro).delete(`/api/finanzas/gastos/${g.id}`)).status, 404)
      assert.equal((await como(yo).get(`/api/finanzas/gastos/${g.id}`)).status, 200)
      assert.equal((await como(yo).delete(`/api/finanzas/gastos/${g.id}`)).status, 204)
      assert.equal((await como(yo).delete(`/api/finanzas/gastos/${g.id}`)).status, 404)
      assert.equal((await como(yo).delete('/api/finanzas/gastos/abc')).status, 400)
    })
  })

  describe('US43 - Consultar gastos', () => {
    it('lista del más reciente al más antiguo con el total exacto', async () => {
      const yo = await comisionista()
      const tipo = await crearTipo(yo, 'Combustible')
      await crearGasto(yo, tipo, { monto: '0.10', fecha: '2026-01-05' })
      await crearGasto(yo, tipo, { monto: '0.20', fecha: '2026-03-10' })
      const res = await como(yo).get('/api/finanzas/gastos')
      assert.deepEqual(res.body.gastos.map((g) => g.fecha), ['2026-03-10', '2026-01-05'])
      assert.deepEqual(res.body.resumen, { cantidad: 2, total: '0.30' })
    })

    it('filtra por rango de fechas, tipo y texto', async () => {
      const yo = await comisionista()
      const combustible = await crearTipo(yo, 'Combustible')
      const peajes = await crearTipo(yo, 'Peajes')
      await crearGasto(yo, combustible, { monto: 100, fecha: '2026-01-10', descripcion: 'Enero' })
      await crearGasto(yo, combustible, { monto: 200, fecha: '2026-03-10' })
      await crearGasto(yo, peajes, { monto: 300, fecha: '2026-03-12', descripcion: 'Ruta 9 100%' })
      const montos = async (qs) => (await como(yo).get(`/api/finanzas/gastos?${qs}`)).body.gastos.map((g) => g.monto)

      assert.deepEqual(await montos('desde=2026-03-01'), ['300.00', '200.00'])
      assert.deepEqual(await montos('hasta=2026-03-10'), ['200.00', '100.00'])
      assert.deepEqual(await montos('desde=2026-03-10&hasta=2026-03-12'), ['300.00', '200.00'])
      assert.deepEqual(await montos(`tipo=${combustible.id}`), ['200.00', '100.00'])
      assert.deepEqual(await montos('q=peaj'), ['300.00'])        // por tipo
      assert.deepEqual(await montos('q=enero'), ['100.00'])        // por descripción
      assert.deepEqual(await montos('q=100%25'), ['300.00'])       // % literal
      const filtrado = await como(yo).get(`/api/finanzas/gastos?tipo=${combustible.id}`)
      assert.deepEqual(filtrado.body.resumen, { cantidad: 2, total: '300.00' })
    })

    it('rechaza filtros inválidos', async () => {
      const yo = await comisionista()
      for (const qs of ['desde=ayer', 'hasta=2026-02-31', 'desde=2026-05-01&hasta=2026-04-01', 'tipo=abc']) {
        assert.equal((await como(yo).get(`/api/finanzas/gastos?${qs}`)).status, 400, qs)
      }
    })

    it('cada comisionista ve solo sus gastos', async () => {
      const yo = await comisionista()
      const otro = await comisionista()
      const mio = await crearGasto(yo, await crearTipo(yo, 'Mio'))
      await crearGasto(otro, await crearTipo(otro, 'Ajeno'))
      assert.deepEqual((await como(yo).get('/api/finanzas/gastos')).body.gastos.map((g) => g.tipo_nombre), ['Mio'])
      assert.equal((await como(otro).get(`/api/finanzas/gastos/${mio.id}`)).status, 404)
      assert.equal((await como(yo).get('/api/finanzas/gastos/abc')).status, 400)
    })
  })
})
