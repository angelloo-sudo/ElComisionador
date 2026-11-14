import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { obtenerViaje } from '../src/controllers/historial.controller.js'

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
  const respuesta = await request(app).get('/api/historial/viajes').set('Authorization', `Bearer ${token('administrador')}`)
  assert.equal(respuesta.status, 403)
})

test('el controlador rechaza un ID inválido al recibir una sesión autorizada', async () => {
  const appControlador = express()
  appControlador.get('/historial/viajes/:id', (req, _res, next) => {
    req.usuario = { id: 123, rol: 'comisionista' }
    next()
  }, obtenerViaje)

  const respuesta = await request(appControlador).get('/historial/viajes/no-es-id')
  assert.equal(respuesta.status, 400)
  assert.equal(respuesta.body.mensaje, 'El viaje no es válido')
})
