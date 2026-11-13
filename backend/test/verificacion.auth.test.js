import assert from 'node:assert/strict'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { describe, it } from 'node:test'
import { autenticar, autenticarVerificacion } from '../src/middlewares/auth.middleware.js'

function llamar(middleware, token) {
  let continuado = false
  const respuesta = {
    estado: null,
    status(codigo) { this.estado = codigo; return this },
    json(cuerpo) { this.cuerpo = cuerpo; return this },
  }
  middleware({ headers: { authorization: `Bearer ${token}` } }, respuesta, () => { continuado = true })
  return { continuado, respuesta }
}

describe('alcance del token temporal de verificación', () => {
  it('permite las rutas de verificación y lo rechaza en el resto de la API', () => {
    const temporal = jwt.sign({ id: 23, rol: 'cliente', tipo: 'verificacion_identidad' }, process.env.JWT_SECRET)
    assert.equal(llamar(autenticarVerificacion, temporal).continuado, true)
    assert.equal(llamar(autenticar, temporal).respuesta.estado, 401)
  })

  it('mantiene acceso de sesión para verificar y bloquea el token de confirmación de correo', () => {
    const sesion = jwt.sign({ id: 24, rol: 'comisionista' }, process.env.JWT_SECRET)
    const correo = jwt.sign({ id: 24, rol: 'comisionista', tipo: 'verificacion_email' }, process.env.JWT_SECRET)
    assert.equal(llamar(autenticarVerificacion, sesion).continuado, true)
    assert.equal(llamar(autenticarVerificacion, correo).respuesta.estado, 401)
  })

  it('no habilita el flujo a roles que no se registran públicamente', () => {
    const administrador = jwt.sign({ id: 25, rol: 'administrador' }, process.env.JWT_SECRET)
    assert.equal(llamar(autenticarVerificacion, administrador).respuesta.estado, 401)
  })
})
