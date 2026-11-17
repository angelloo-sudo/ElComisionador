import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'
import { hoyEnCordoba } from '../src/services/estado-viaje.js'

const api = request(app)
const runId = randomUUID()
const emails = new Set()
const viajeIds = new Set()
const pasajeroIds = new Set()
let sequence = 0

async function usuario(rol) {
  const email = `qa-paradas-${runId}-${++sequence}@example.test`
  const dni = String(Date.now() + sequence)
  emails.add(email)
  const { rows: [creado] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol, email_verificado)
     VALUES ($1, $2, $3, $4, 'solo-test', $5, true) RETURNING id`,
    ['Prueba', rol, email, dni, rol],
  )
  if (rol === 'comisionista') {
    await query(
      `INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en, resuelta_en, resuelta_por)
       VALUES ($1, 'APROBADA_MANUALMENTE', NOW(), NOW(), $1)`,
      [creado.id],
    )
  }
  return {
    id: creado.id,
    token: jwt.sign({ id: creado.id, email, rol }, process.env.JWT_SECRET, { expiresIn: '1h' }),
  }
}

async function crearViaje(usuarioId) {
  const { rows: [viaje] } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, estado)
     VALUES ($1, 'Córdoba', 'Villa María', $2, 'programado') RETURNING id`,
    [usuarioId, hoyEnCordoba()],
  )
  viajeIds.add(viaje.id)
  return viaje.id
}

async function crearCliente(usuarioId) {
  const { rows: [cliente] } = await query(
    'INSERT INTO clientes (usuario_id) VALUES ($1) RETURNING id',
    [usuarioId],
  )
  return cliente.id
}

async function crearSolicitud(viajeId, clienteId, datos) {
  const { rows: [solicitud] } = await query(
    `INSERT INTO solicitudes_viaje (
       viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
       origen_localidad, destino_localidad, nombre, apellido, cantidad_pasajeros,
       emisor_nombre, emisor_apellido, receptor_nombre, receptor_apellido, estado_pasajero, retirada_en
     ) VALUES ($1, $2, $3, $4, 'Mitre', '10', 'San Martín', '20', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      viajeId, clienteId, datos.tipo, datos.estado ?? 'aceptada',
      datos.origen ?? 'Córdoba', datos.destino ?? 'Villa María',
      datos.nombre ?? null, datos.apellido ?? null, datos.cantidad ?? null,
      datos.emisor ?? null, datos.apellidoEmisor ?? null, datos.receptor ?? null, datos.apellidoReceptor ?? null,
      datos.estadoPasajero ?? null, datos.retiradaEn ?? null,
    ],
  )
  return solicitud.id
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` })

describe('Recorrido dinámico del viaje', () => {
  afterEach(async () => {
    if (pasajeroIds.size) {
      await query('DELETE FROM pasajeros WHERE id = ANY($1::int[])', [Array.from(pasajeroIds)])
      pasajeroIds.clear()
    }
    if (viajeIds.size) {
      const ids = Array.from(viajeIds)
      await query('DELETE FROM encomiendas WHERE viaje_id = ANY($1::int[])', [ids])
      await query('DELETE FROM viajes WHERE id = ANY($1::int[])', [ids])
      viajeIds.clear()
    }
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  it('agrupa actividades, refleja su estado y limita las paradas al viaje del comisionista', async () => {
    const comisionista = await usuario('comisionista')
    const otroComisionista = await usuario('comisionista')
    const cliente = await usuario('cliente')
    const clienteId = await crearCliente(cliente.id)
    const viajeId = await crearViaje(comisionista.id)
    const otroViajeId = await crearViaje(comisionista.id)
    const pasajeroId = await crearSolicitud(viajeId, clienteId, {
      tipo: 'pasajero', nombre: 'Juan', apellido: 'Pérez', cantidad: 1, estadoPasajero: 'a_bordo',
    })
    const encomiendaId = await crearSolicitud(viajeId, clienteId, {
      tipo: 'encomienda', emisor: 'María', apellidoEmisor: 'González',
      receptor: 'Destinatario', apellidoReceptor: 'Final', retiradaEn: new Date(),
    })
    const canceladaId = await crearSolicitud(viajeId, clienteId, {
      tipo: 'pasajero', estado: 'cancelada', nombre: 'No', apellido: 'Mostrar', cantidad: 1,
    })
    const otraSolicitudId = await crearSolicitud(otroViajeId, clienteId, {
      tipo: 'pasajero', nombre: 'Otro', apellido: 'Viaje', cantidad: 1,
    })

    const respuesta = await api.get(`/api/viajes/${viajeId}/paradas`).set(auth(comisionista))
    assert.equal(respuesta.status, 200, JSON.stringify(respuesta.body))
    const paradas = respuesta.body.recorrido.paradas
    assert.deepEqual(paradas.map((parada) => parada.tipo), ['origen', 'destino'])
    assert.equal(paradas[0].actividades.length, 2)
    assert.equal(paradas[1].actividades.length, 3)

    const actividad = (parada, id, lado) => parada.actividades.find((item) => item.solicitud_id === id && item.lado === lado)
    assert.equal(actividad(paradas[0], pasajeroId, 'origen').estado_actividad, 'completada')
    assert.equal(actividad(paradas[1], pasajeroId, 'destino').estado_actividad, 'pendiente')
    assert.equal(actividad(paradas[0], encomiendaId, 'origen').estado_actividad, 'completada')
    assert.equal(actividad(paradas[1], encomiendaId, 'destino').codigo_seguimiento, null)
    assert.equal(actividad(paradas[1], encomiendaId, 'destino').persona, 'Destinatario Final')
    assert.equal(paradas[1].actividades.some((item) => item.solicitud_id === canceladaId), false)
    assert.equal(paradas.some((parada) => parada.actividades.some((item) => item.solicitud_id === otraSolicitudId)), false)

    const ajeno = await api.get(`/api/viajes/${viajeId}/paradas`).set(auth(otroComisionista))
    assert.equal(ajeno.status, 404)
  })

  it('incluye registros legados y no inventa localidades ni estados operativos', async () => {
    const comisionista = await usuario('comisionista')
    const viajeId = await crearViaje(comisionista.id)
    const { rows: [encomienda] } = await query(
      `INSERT INTO encomiendas (
         viaje_id, remitente_nombre, direccion_retiro, destinatario_nombre, destinatario_direccion, estado, retirado_en
       ) VALUES ($1, 'Remitente', 'Calle Retiro 10', 'Destinatario', 'Calle Entrega 20', 'retirado', NOW())
       RETURNING id`,
      [viajeId],
    )
    const { rows: [pasajero] } = await query(
      `INSERT INTO pasajeros (nombre) VALUES ('Pasajero legado') RETURNING id`,
    )
    pasajeroIds.add(pasajero.id)
    await query(
      `INSERT INTO viaje_pasajero (viaje_id, pasajero_id, punto_ascenso, punto_descenso, estado)
       VALUES ($1, $2, 'Córdoba', 'Bell Ville', 'activo')`,
      [viajeId, pasajero.id],
    )

    const respuesta = await api.get(`/api/viajes/${viajeId}/paradas`).set(auth(comisionista))
    assert.equal(respuesta.status, 200, JSON.stringify(respuesta.body))
    const actividades = respuesta.body.recorrido.paradas.flatMap((parada) => parada.actividades)
    const retiro = actividades.find((item) => item.encomienda_id === encomienda.id && item.lado === 'origen')
    const entrega = actividades.find((item) => item.encomienda_id === encomienda.id && item.lado === 'destino')
    assert.equal(retiro.estado_actividad, 'completada')
    assert.equal(entrega.estado_actividad, 'pendiente')
    assert.equal(entrega.persona, 'Destinatario')
    assert.equal(entrega.direccion, 'Calle Entrega 20')
    assert.equal(entrega.localidad_desconocida, true)
    assert.equal(actividades.find((item) => item.pasajero_id === pasajero.id && item.lado === 'destino').estado_actividad, 'sin_estado')
    assert.equal(respuesta.body.recorrido.orden_confirmado, false)
  })
})
