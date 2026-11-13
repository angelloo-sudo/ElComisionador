import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const runId = randomUUID()
const emails = new Set()
let sequence = 0

async function usuario(rol, { cliente = false } = {}) {
  const email = `qa-historial-${runId}-${++sequence}@example.test`
  emails.add(email)
  const dni = String(Number.parseInt(runId.replaceAll('-', '').slice(sequence * 2, sequence * 2 + 8), 16) + sequence)
  const { rows: [user] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol)
     VALUES ($1, $2, $3, $4, 'solo-test', $5) RETURNING id`,
    [cliente ? 'Lucía' : 'Comisionista', cliente ? 'Prueba' : 'QA', email, dni, rol],
  )
  const token = jwt.sign({ id: user.id, email, rol }, process.env.JWT_SECRET, { expiresIn: '1h' })
  let clienteId
  if (cliente) {
    const { rows: [row] } = await query('INSERT INTO clientes (usuario_id) VALUES ($1) RETURNING id', [user.id])
    clienteId = row.id
  }
  return { id: user.id, token, clienteId }
}

async function viaje(usuarioId, { origen, destino, fecha, estado }) {
  const { rows: [row] } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, estado)
     VALUES ($1, $2, $3, $4, '08:00', '12:00', $5) RETURNING id`,
    [usuarioId, origen, destino, fecha, estado],
  )
  return row.id
}

function auth(user) { return { Authorization: `Bearer ${user.token}` } }

describe('US53-US56: historiales de comisionistas', () => {
  afterEach(async () => {
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  it('aísla viajes, clientes, encomiendas, pasajeros, filtros, detalles y cambios de estado', async () => {
    const comisionista = await usuario('comisionista')
    const otroComisionista = await usuario('comisionista')
    const cliente = await usuario('cliente', { cliente: true })
    const propioCancelado = await viaje(comisionista.id, {
      origen: 'Córdoba Capital', destino: 'Villa Carlos Paz', fecha: '2026-11-04', estado: 'cancelado',
    })
    const propioFinalizado = await viaje(comisionista.id, {
      origen: 'Alta Gracia', destino: 'Río Cuarto', fecha: '2026-11-05', estado: 'finalizado',
    })
    const propioVencido = await viaje(comisionista.id, {
      origen: 'Villa María', destino: 'Río Cuarto',
      fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      estado: 'programado',
    })
    const ajeno = await viaje(otroComisionista.id, {
      origen: 'Alta Gracia', destino: 'Mendoza', fecha: '2026-11-05', estado: 'finalizado',
    })
    await query(
      `INSERT INTO paradas_viaje (viaje_id, orden, localidad, hora_estimada)
       VALUES ($1, 1, 'Cosquín', '09:10'), ($1, 2, 'La Falda', '10:00')`, [propioFinalizado],
    )

    const pasajeroUno = await query(
      `INSERT INTO solicitudes_viaje
        (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
         nombre, apellido, origen_localidad, destino_localidad)
       VALUES ($1,$2,'pasajero','aceptada','San Martín','10','Belgrano','20','Ana','Pérez','Alta Gracia','La Falda') RETURNING id`,
      [propioFinalizado, cliente.clienteId],
    )
    const pasajeroDos = await query(
      `INSERT INTO solicitudes_viaje
        (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
         nombre, apellido, origen_localidad, destino_localidad)
       VALUES ($1,$2,'pasajero','cancelada','San Martín','11','Belgrano','21','Ana','Pérez','Cosquín','Río Cuarto') RETURNING id`,
      [propioCancelado, cliente.clienteId],
    )

    const moderna = await query(
      `INSERT INTO solicitudes_viaje
        (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
         emisor_nombre, emisor_apellido, receptor_nombre, receptor_apellido, origen_localidad, destino_localidad,
         tipo_contenido, peso_kg)
       VALUES ($1,$2,'encomienda','pendiente','San Martín','10','Belgrano','20','Ana','Pérez','Luis','Díaz',
         'Alta Gracia','La Falda','libros',2) RETURNING id`, [propioFinalizado, cliente.clienteId],
    )
    await query("UPDATE solicitudes_viaje SET estado='aceptada' WHERE id=$1", [moderna.rows[0].id])

    const legada = await query(
      `INSERT INTO encomiendas
        (viaje_id, cliente_remitente_id, remitente_nombre, remitente_telefono, direccion_retiro,
         destinatario_nombre, destinatario_telefono, destinatario_direccion, tipo_contenido, peso_kg)
       VALUES ($1,$2,'Ana Pérez','3510000000','San Martín 10','Luis Díaz','3511111111','Belgrano 20','libros',2)
       RETURNING id`, [propioFinalizado, cliente.clienteId],
    )
    await query("UPDATE encomiendas SET estado='aceptado' WHERE id=$1", [legada.rows[0].id])
    await query("UPDATE encomiendas SET estado='retirado' WHERE id=$1", [legada.rows[0].id])

    const viajes = await api.get('/api/historial/viajes?desde=2026-11-01&hasta=2026-11-30&origen=alta')
      .set(auth(comisionista))
    assert.equal(viajes.status, 200, JSON.stringify(viajes.body))
    assert.deepEqual(viajes.body.viajes.map((v) => v.id), [propioFinalizado])
    assert.equal(viajes.body.viajes[0].estado, 'finalizado')
    const historialCompleto = await api.get('/api/historial/viajes').set(auth(comisionista))
    assert.equal(historialCompleto.status, 200, JSON.stringify(historialCompleto.body))
    assert.equal(historialCompleto.body.viajes.find((v) => v.id === propioVencido).estado, 'vencido')
    const detalleVencido = await api.get(`/api/historial/viajes/${propioVencido}`).set(auth(comisionista))
    assert.equal(detalleVencido.body.viaje.estado, 'vencido')
    const detalleViaje = await api.get(`/api/historial/viajes/${propioFinalizado}`).set(auth(comisionista))
    assert.deepEqual(detalleViaje.body.viaje.paradas.map((p) => p.localidad), ['Cosquín', 'La Falda'])
    assert.equal((await api.get(`/api/historial/viajes/${ajeno}`).set(auth(comisionista)).expect(404)).status, 404)

    const clientes = await api.get('/api/historial/clientes').set(auth(comisionista))
    assert.deepEqual(clientes.body.clientes.map((c) => c.id), [cliente.clienteId])
    const operaciones = await api.get(`/api/historial/clientes/${cliente.clienteId}/operaciones?tipo=pasajero`)
      .set(auth(comisionista))
    assert.deepEqual(operaciones.body.operaciones.map((o) => o.id).sort((a, b) => a - b),
      [pasajeroUno.rows[0].id, pasajeroDos.rows[0].id].sort((a, b) => a - b))
    assert.deepEqual(new Set(operaciones.body.operaciones.map((o) => o.estado)), new Set(['aceptada', 'cancelada']))
    const operacionesTodas = await api.get(`/api/historial/clientes/${cliente.clienteId}/operaciones`).set(auth(comisionista))
    assert.equal(operacionesTodas.body.operaciones.length, 4)
    const otroClienteVista = await api.get(`/api/historial/clientes/${cliente.clienteId}/operaciones`)
      .set(auth(otroComisionista))
    assert.equal(otroClienteVista.status, 404)

    const envios = await api.get('/api/historial/encomiendas?desde=2026-11-01&hasta=2026-11-30&origen=Alta%20Gracia')
      .set(auth(comisionista))
    assert.equal(envios.status, 200, JSON.stringify(envios.body))
    assert.equal(envios.body.encomiendas.length, 1)
    assert.equal(envios.body.encomiendas[0].origen_registro, 'solicitud')
    const detalleModerno = await api.get(`/api/historial/encomiendas/solicitud/${moderna.rows[0].id}`).set(auth(comisionista))
    assert.deepEqual(detalleModerno.body.encomienda.historial.map((h) => h.estado), ['pendiente', 'aceptada'])
    const detalleLegado = await api.get(`/api/historial/encomiendas/encomienda/${legada.rows[0].id}`).set(auth(comisionista))
    assert.deepEqual(detalleLegado.body.encomienda.historial.map((h) => h.estado), ['pendiente', 'aceptado', 'retirado'])
    assert.equal((await api.get(`/api/historial/encomiendas/solicitud/${moderna.rows[0].id}`).set(auth(otroComisionista))).status, 404)

    const pasajeros = await api.get('/api/historial/pasajeros?nombre=Ana&origen=Alta%20Gracia')
      .set(auth(comisionista))
    assert.equal(pasajeros.status, 200, JSON.stringify(pasajeros.body))
    assert.deepEqual(pasajeros.body.pasajeros.map((p) => p.solicitud_id), [pasajeroUno.rows[0].id])
    assert.equal((await api.get(`/api/historial/pasajeros/${pasajeroUno.rows[0].id}`).set(auth(comisionista))).status, 200)
    assert.equal((await api.get(`/api/historial/pasajeros/${pasajeroUno.rows[0].id}`).set(auth(otroComisionista))).status, 404)
  })
})
