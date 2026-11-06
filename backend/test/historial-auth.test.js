import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.JWT_SECRET = 'secret-prueba-historiales'
const { default: historialRoutes } = await import('../src/routes/historial.routes.js')
const app = express()
app.use('/api/historial', historialRoutes)

function token(rol) {
  return jwt.sign({ id: 123, rol }, process.env.JWT_SECRET, { expiresIn: '1h' })
}

test('las rutas de historial requieren una sesión', async () => {
  const respuesta = await request(app).get('/api/historial/viajes')
  assert.equal(respuesta.status, 401)
})

test('las rutas de historial rechazan roles distintos de comisionista', async () => {
  const respuesta = await request(app).get('/api/historial/viajes').set('Authorization', `Bearer ${token('cliente')}`)
  assert.equal(respuesta.status, 403)
})

test('la ruta autenticada valida el ID antes de consultar la base', async () => {
  const respuesta = await request(app).get('/api/historial/viajes/no-es-id').set('Authorization', `Bearer ${token('comisionista')}`)
  assert.equal(respuesta.status, 400)
  assert.equal(respuesta.body.mensaje, 'El viaje no es válido')
})
