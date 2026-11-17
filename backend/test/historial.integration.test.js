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
  if (rol === 'comisionista') {
    await query(
      `INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en, resuelta_en, resuelta_por)
       VALUES ($1, 'APROBADA_MANUALMENTE', NOW(), NOW(), $1)`, [user.id],
    )
  }
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
         nombre, apellido, origen_localidad, destino_localidad, cantidad_pasajeros)
       VALUES ($1,$2,'pasajero','aceptada','San Martín','10','Belgrano','20','Ana','Pérez','Alta Gracia','La Falda',1) RETURNING id`,
      [propioFinalizado, cliente.clienteId],
    )
    const pasajeroDos = await query(
      `INSERT INTO solicitudes_viaje
        (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
         nombre, apellido, origen_localidad, destino_localidad, cantidad_pasajeros)
       VALUES ($1,$2,'pasajero','cancelada','San Martín','11','Belgrano','21','Ana','Pérez','Cosquín','Río Cuarto',1) RETURNING id`,
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
    assert.equal(historialCompleto.body.viajes.some((v) => v.id === propioVencido), false)
    assert.equal(historialCompleto.body.viajes.find((v) => v.id === propioCancelado).estado, 'cancelado')
    const detalleVencido = await api.get(`/api/historial/viajes/${propioVencido}`).set(auth(comisionista))
    assert.equal(detalleVencido.body.viaje.estado, 'vencido')
    const detalleViaje = await api.get(`/api/historial/viajes/${propioFinalizado}`).set(auth(comisionista))
    assert.deepEqual(detalleViaje.body.viaje.paradas.map((p) => p.localidad), ['Cosquín', 'La Falda'])
    assert.equal(detalleViaje.body.viaje.cantidad_encomiendas, 2)
    assert.equal(detalleViaje.body.viaje.cantidad_pasajeros, 1)
    assert.deepEqual(new Set(detalleViaje.body.viaje.encomiendas.map((e) => e.viaje_id)), new Set([propioFinalizado]))
    assert.deepEqual(detalleViaje.body.viaje.pasajeros.map((p) => p.solicitud_id), [pasajeroUno.rows[0].id])
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

  it('agrupa por viaje ambos tipos de encomienda y pasajeros sin mezclar viajes ni comisionistas', async () => {
    const comisionista = await usuario('comisionista')
    const otroComisionista = await usuario('comisionista')
    const cliente = await usuario('cliente', { cliente: true })
    const ambos = await viaje(comisionista.id, {
      origen: 'Córdoba', destino: 'Villa María', fecha: '2026-11-10', estado: 'finalizado',
    })
    const soloEncomiendas = await viaje(comisionista.id, {
      origen: 'Córdoba', destino: 'Río Cuarto', fecha: '2026-11-11', estado: 'cancelado',
    })
    const soloPasajeros = await viaje(comisionista.id, {
      origen: 'Córdoba', destino: 'Alta Gracia', fecha: '2026-11-12', estado: 'finalizado',
    })
    const sinAsociaciones = await viaje(comisionista.id, {
      origen: 'Córdoba', destino: 'Cosquín', fecha: '2026-11-13', estado: 'cancelado',
    })
    const viajeAjeno = await viaje(otroComisionista.id, {
      origen: 'Córdoba', destino: 'Mendoza', fecha: '2026-11-14', estado: 'finalizado',
    })

    const crearEncomiendaLegada = async (viajeId, remitente) => {
      const { rows: [fila] } = await query(
        `INSERT INTO encomiendas
          (viaje_id, cliente_remitente_id, remitente_nombre, destinatario_nombre, tipo_contenido, peso_kg)
         VALUES ($1, $2, $3, 'Destinatario QA', 'libros', 1) RETURNING id`,
        [viajeId, cliente.clienteId, remitente],
      )
      return fila.id
    }
    const crearSolicitudEncomienda = async (viajeId, remitente) => {
      const { rows: [fila] } = await query(
        `INSERT INTO solicitudes_viaje
          (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
           emisor_nombre, emisor_apellido, receptor_nombre, receptor_apellido, tipo_contenido, peso_kg,
           origen_localidad, destino_localidad)
         VALUES ($1,$2,'encomienda','aceptada','San Martín','10','Belgrano','20',$3,'QA','Destino','QA',
                 'libros',1,'Córdoba','Villa María') RETURNING id`,
        [viajeId, cliente.clienteId, remitente],
      )
      return fila.id
    }
    const crearPasajero = async (viajeId, pasajero, cantidad) => {
      const { rows: [fila] } = await query(
        `INSERT INTO solicitudes_viaje
          (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura,
           nombre, apellido, origen_localidad, destino_localidad, cantidad_pasajeros)
         VALUES ($1,$2,'pasajero','aceptada','San Martín','10','Belgrano','20',$3,'QA','Córdoba','Villa María',$4)
         RETURNING id`,
        [viajeId, cliente.clienteId, pasajero, cantidad],
      )
      return fila.id
    }

    const idsEncomiendas = [
      await crearEncomiendaLegada(ambos, 'Remitente legado'),
      await crearSolicitudEncomienda(ambos, 'Remitente moderno'),
      await crearSolicitudEncomienda(soloEncomiendas, 'Remitente cancelado'),
      await crearEncomiendaLegada(viajeAjeno, 'Remitente ajeno'),
    ]
    const idsPasajeros = [
      await crearPasajero(ambos, 'Ana', 2),
      await crearPasajero(ambos, 'Luis', 3),
      await crearPasajero(soloPasajeros, 'Marta', 1),
      await crearPasajero(viajeAjeno, 'Pasajero ajeno', 1),
    ]

    const respuesta = await api.get('/api/historial/viajes').set(auth(comisionista))
    assert.equal(respuesta.status, 200, JSON.stringify(respuesta.body))
    const filas = respuesta.body.viajes
    assert.deepEqual(new Set(filas.map((fila) => fila.id)), new Set([ambos, soloEncomiendas, soloPasajeros, sinAsociaciones]))
    assert.equal(filas.find((fila) => fila.id === ambos).cantidad_encomiendas, 2)
    assert.equal(filas.find((fila) => fila.id === ambos).cantidad_pasajeros, 5)
    assert.equal(filas.find((fila) => fila.id === soloEncomiendas).cantidad_encomiendas, 1)
    assert.equal(filas.find((fila) => fila.id === soloEncomiendas).cantidad_pasajeros, 0)
    assert.equal(filas.find((fila) => fila.id === soloPasajeros).cantidad_encomiendas, 0)
    assert.equal(filas.find((fila) => fila.id === soloPasajeros).cantidad_pasajeros, 1)
    assert.equal(filas.find((fila) => fila.id === sinAsociaciones).cantidad_encomiendas, 0)
    assert.equal(filas.find((fila) => fila.id === sinAsociaciones).cantidad_pasajeros, 0)

    const porEncomiendas = await api.get('/api/historial/viajes?contenido=encomiendas').set(auth(comisionista))
    assert.deepEqual(new Set(porEncomiendas.body.viajes.map((fila) => fila.id)), new Set([ambos, soloEncomiendas]))
    const porPasajeros = await api.get('/api/historial/viajes?contenido=pasajeros').set(auth(comisionista))
    assert.deepEqual(new Set(porPasajeros.body.viajes.map((fila) => fila.id)), new Set([ambos, soloPasajeros]))
    const porAmbos = await api.get('/api/historial/viajes?contenido=ambos').set(auth(comisionista))
    assert.deepEqual(porAmbos.body.viajes.map((fila) => fila.id), [ambos])
    const porDestino = await api.get('/api/historial/viajes?destino=Villa%20Mar%C3%ADa').set(auth(comisionista))
    assert.deepEqual(porDestino.body.viajes.map((fila) => fila.id), [ambos])
    const cancelados = await api.get('/api/historial/viajes?estado=cancelado').set(auth(comisionista))
    assert.deepEqual(new Set(cancelados.body.viajes.map((fila) => fila.id)), new Set([soloEncomiendas, sinAsociaciones]))
    const finalizados = await api.get('/api/historial/viajes?estado=finalizado').set(auth(comisionista))
    assert.deepEqual(new Set(finalizados.body.viajes.map((fila) => fila.id)), new Set([ambos, soloPasajeros]))
    assert.equal((await api.get('/api/historial/viajes?estado=programado').set(auth(comisionista))).status, 400)

    const detalle = await api.get(`/api/historial/viajes/${ambos}`).set(auth(comisionista))
    assert.equal(detalle.status, 200, JSON.stringify(detalle.body))
    assert.deepEqual(new Set(detalle.body.viaje.encomiendas.map((fila) => fila.id)), new Set(idsEncomiendas.slice(0, 2)))
    assert.deepEqual(new Set(detalle.body.viaje.encomiendas.map((fila) => fila.viaje_id)), new Set([ambos]))
    assert.deepEqual(new Set(detalle.body.viaje.pasajeros.map((fila) => fila.solicitud_id)), new Set(idsPasajeros.slice(0, 2)))
    assert.deepEqual(new Set(detalle.body.viaje.pasajeros.map((fila) => fila.viaje_id)), new Set([ambos]))
    assert.equal((await api.get(`/api/historial/viajes/${sinAsociaciones}`).set(auth(comisionista))).body.viaje.encomiendas.length, 0)
    assert.equal((await api.get(`/api/historial/viajes/${sinAsociaciones}`).set(auth(comisionista))).body.viaje.pasajeros.length, 0)
    assert.equal((await api.get(`/api/historial/viajes/${viajeAjeno}`).set(auth(comisionista))).status, 404)

    const detalleEncomienda = await api.get(`/api/historial/encomiendas/solicitud/${idsEncomiendas[1]}`).set(auth(comisionista))
    assert.equal(detalleEncomienda.body.encomienda.viaje_id, ambos)
    const detallePasajero = await api.get(`/api/historial/pasajeros/${idsPasajeros[1]}`).set(auth(comisionista))
    assert.equal(detallePasajero.body.pasajero.viaje_id, ambos)
  })
})
