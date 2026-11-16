import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import adminRoutes from '../src/routes/admin.routes.js'
import verificacionesRoutes from '../src/routes/verificaciones.routes.js'
import { autenticar } from '../src/middlewares/auth.middleware.js'
import { pool } from '../src/config/db.js'

const estadisticas = {
  clientes: 2,
  comisionistas: 3,
  comisionistas_activos: 2,
  comisionistas_pendientes: 1,
  comisionistas_aprobados: 1,
  comisionistas_rechazados: 0,
  comisionistas_en_proceso: 1,
  comisionistas_requieren_correccion: 0,
  viajes_total: 4,
  viajes_activos: 2,
  viajes_programados: 1,
  viajes_en_curso: 1,
  viajes_finalizados: 1,
  encomiendas_total: 5,
  encomiendas_pendientes: 2,
  encomiendas_entregadas: 1,
}

function token(rol) {
  return jwt.sign({ id: 21, email: `${rol}@example.test`, rol }, process.env.JWT_SECRET, { expiresIn: '5m' })
}

describe('acceso de administración', () => {
  it('limita el panel al administrador y aplica el estado de identidad más reciente', async (t) => {
    let estadoIdentidad = 'APROBADA_MANUALMENTE'
    const consultas = []
    t.mock.method(pool, 'query', async (sql) => {
      consultas.push(sql)
      if (sql.includes('SELECT u.email_verificado')) {
        return { rows: [{ email_verificado: true, identidad_aprobada: estadoIdentidad === 'APROBADA_MANUALMENTE' }] }
      }
      if (sql.includes('WITH ultima_verificacion')) return { rows: [estadisticas] }
      if (sql.includes("WITH meses AS")) return { rows: [{ mes: '2026-11', clientes: 2, comisionistas: 3 }] }
      if (sql.includes('SELECT * FROM (')) return { rows: [] }
      if (sql.includes('COUNT(*)::int AS total')) return { rows: [{ total: 1 }] }
      if (sql.includes('SELECT u.id, u.nombre, u.apellido')) {
        return { rows: [{ id: 31, nombre: 'Comi', rol: 'comisionista', activo: true, estado_verificacion: 'APROBADA_MANUALMENTE' }] }
      }
      return { rows: [] }
    })

    const app = express()
    app.use('/api/admin', adminRoutes)
    app.get('/api/protegida', autenticar, (req, res) => res.json({ permitido: true }))
    const api = request(app)

    assert.equal((await api.get('/api/admin/resumen')).status, 401)

    const admin = token('administrador')
    const dashboard = await api.get('/api/admin/resumen').set('Authorization', `Bearer ${admin}`)
    assert.equal(dashboard.status, 200)
    assert.equal(dashboard.body.estadisticas.comisionistas_pendientes, 1)

    const usuarios = await api.get('/api/admin/usuarios?pagina=1&porPagina=5').set('Authorization', `Bearer ${admin}`)
    assert.equal(usuarios.status, 200)
    assert.equal(usuarios.body.usuarios.length, 1)
    assert.equal(Object.keys(usuarios.body.usuarios[0]).some((campo) => /password|token|hash/i.test(campo)), false)

    for (const rol of ['cliente', 'comisionista']) {
      assert.equal((await api.get('/api/admin/resumen').set('Authorization', `Bearer ${token(rol)}`)).status, 403)
    }

    const comisionista = `Bearer ${token('comisionista')}`
    estadoIdentidad = 'PENDIENTE_REVISION'
    assert.equal((await api.get('/api/protegida').set('Authorization', comisionista)).status, 403)
    estadoIdentidad = 'RECHAZADA'
    assert.equal((await api.get('/api/protegida').set('Authorization', comisionista)).status, 403)
    estadoIdentidad = 'APROBADA_MANUALMENTE'
    assert.equal((await api.get('/api/protegida').set('Authorization', comisionista)).status, 200)
    assert.ok(consultas.some((sql) => sql.includes('ORDER BY v.iniciada_en DESC, v.id DESC')))
  })

  it('solo permite decisiones de identidad al administrador y exige evidencia y motivo', async (t) => {
    let updateSql = ''
    t.mock.method(pool, 'query', async (sql, params) => {
      if (sql.includes('SELECT u.email_verificado')) {
        return { rows: [{ email_verificado: true, identidad_aprobada: true }] }
      }
      if (sql.startsWith('UPDATE verificaciones_identidad')) {
        updateSql = sql
        if (params[1] === 'APROBADA_MANUALMENTE') return { rows: [] }
        return {
          rows: [{
            id: Number(params[0]),
            estado: params[1],
            motivo_resolucion: params[2],
            resuelta_por: params[3],
            resuelta_en: '2026-11-15T20:00:00.000Z',
            actualizada_en: '2026-11-15T20:00:00.000Z',
          }],
        }
      }
      return { rows: [] }
    })

    const app = express()
    app.use(express.json())
    app.use('/api/verificaciones', verificacionesRoutes)
    const api = request(app)

    assert.equal((await api.patch('/api/verificaciones/admin/42/resolver').set('Authorization', `Bearer ${token('cliente')}`).send({ decision: 'RECHAZADA', motivo: 'Revisión requerida' })).status, 403)
    assert.equal((await api.patch('/api/verificaciones/admin/42/resolver').set('Authorization', `Bearer ${token('administrador')}`).send({ decision: 'RECHAZADA' })).status, 400)

    const rechazada = await api.patch('/api/verificaciones/admin/42/resolver')
      .set('Authorization', `Bearer ${token('administrador')}`)
      .send({ decision: 'RECHAZADA', motivo: 'DNI ilegible' })
    assert.equal(rechazada.status, 200)
    assert.equal(rechazada.body.estado, 'RECHAZADA')
    assert.equal(rechazada.body.resuelta_por, 21)
    assert.equal(rechazada.body.motivo_resolucion, 'DNI ilegible')

    const sinEvidencia = await api.patch('/api/verificaciones/admin/42/resolver')
      .set('Authorization', `Bearer ${token('administrador')}`)
      .send({ decision: 'APROBADA_MANUALMENTE' })
    assert.equal(sinEvidencia.status, 404)
    assert.match(updateSql, /resultado_ocr = 'legible'/)
    assert.match(updateSql, /coincidencias->>'dni' = 'true'/)
    assert.match(updateSql, /u\.rol = 'comisionista'/)
  })
})
