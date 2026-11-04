import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { hoyEnCordoba } from '../src/services/estado-viaje.js'

const api = request(app)
const prefijo = `qa-edicion-${randomUUID()}-`
const emails = new Set()
let secuencia = 0
let contacto = Date.now() % 10000000
const auth = (sesion) => ({ Authorization: `Bearer ${sesion.token}` })

function datosContacto() {
  contacto += 1
  return { dni: String(10000000 + (contacto % 89999999)), telefono: `351${String(1000000 + (contacto % 8999999))}` }
}

async function registrar(rol) {
  const email = `${prefijo}${rol}-${++secuencia}@example.test`
  emails.add(email)
  const password = 'ClaveSegura-2026!'
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const creado = await api.post(`/api/auth/${ruta}`).send({ nombre: 'Facundo', apellido: rol === 'cliente' ? 'Cliente' : 'Comisionista', email, password, confirmarPassword: password, ...datosContacto() })
  assert.equal(creado.status, 201, JSON.stringify(creado.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return login.body
}

after(async () => { await pool.end() })

describe('US18: edición segura y notificaciones persistentes', () => {
  afterEach(async () => {
    await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
    emails.clear()
  })

  it('bloquea recorrido/capacidad inválidos y notifica una vez al cliente vinculado', async () => {
    const comisionista = await registrar('comisionista')
    const cliente = await registrar('cliente')
    const fecha = new Date(`${hoyEnCordoba()}T12:00:00Z`)
    fecha.setUTCDate(fecha.getUTCDate() + 2)
    const { rows: viajes } = await query(
      `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, cupo_total)
       VALUES ($1, 'Córdoba', 'Villa María', $2::date, '08:00', '10:00', 3) RETURNING id`, [comisionista.usuario.id, fecha.toISOString().slice(0, 10)],
    )
    const viajeId = viajes[0].id
    const { rows: clientes } = await query('SELECT id FROM clientes WHERE usuario_id = $1', [cliente.usuario.id])
    const clienteId = clientes[0].id
    await query(
      `INSERT INTO solicitudes_viaje (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura, cantidad_pasajeros)
       VALUES ($1, $2, 'pasajero', 'aceptada', 'San Martín', '10', 'Belgrano', '20', 2),
              ($1, $2, 'encomienda', 'aceptada', 'San Martín', '10', 'Belgrano', '20', NULL)`, [viajeId, clienteId],
    )
    await query(`INSERT INTO encomiendas (viaje_id, cliente_remitente_id, destinatario_nombre) VALUES ($1, $2, 'Destinatario')`, [viajeId, clienteId])

    const conRecorrido = await api.put(`/api/viajes/${viajeId}`).set(auth(comisionista)).send({
      origen: 'Río Cuarto', hora_salida: '09:00', hora_llegada: '11:00', cupo_total: 5,
    })
    assert.equal(conRecorrido.status, 400)

    const capacidadInsuficiente = await api.put(`/api/viajes/${viajeId}`).set(auth(comisionista)).send({
      hora_salida: '09:00', hora_llegada: '11:00', cupo_total: 1,
    })
    assert.equal(capacidadInsuficiente.status, 409)

    const actualizado = await api.put(`/api/viajes/${viajeId}`).set(auth(comisionista)).send({
      hora_salida: '09:00', hora_llegada: '11:00', cupo_total: 5,
    })
    assert.equal(actualizado.status, 200, JSON.stringify(actualizado.body))
    assert.equal(actualizado.body.origen, 'Córdoba')
    assert.equal(actualizado.body.destino, 'Villa María')
    assert.equal(actualizado.body.cupo_total, 5)

    const { rows: reservas } = await query("SELECT estado, COUNT(*)::int AS cantidad FROM solicitudes_viaje WHERE viaje_id = $1 GROUP BY estado", [viajeId])
    assert.equal(reservas[0].cantidad, 2)
    assert.equal(reservas[0].estado, 'aceptada')
    const { rows: encomiendas } = await query('SELECT COUNT(*)::int AS cantidad FROM encomiendas WHERE viaje_id = $1', [viajeId])
    assert.equal(encomiendas[0].cantidad, 1)

    const notificaciones = await api.get('/api/notificaciones').set(auth(cliente))
    assert.equal(notificaciones.status, 200, JSON.stringify(notificaciones.body))
    assert.equal(notificaciones.body.length, 1)
    assert.equal(notificaciones.body[0].titulo, 'Tu viaje ha sido modificado')
    assert.match(notificaciones.body[0].mensaje, /09:00 hs/)
    assert.match(notificaciones.body[0].mensaje, /11:00 hs/)
    const leida = await api.patch(`/api/notificaciones/${notificaciones.body[0].id}/leida`).set(auth(cliente)).send({})
    assert.equal(leida.status, 200)
  })
})
