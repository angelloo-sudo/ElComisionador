// Fallas lógicas de la revisión de la base de datos (docs/BDDFallasLogica.pdf):
//  1. un administrador que resolvió verificaciones puede darse de baja;
//  2. la baja se bloquea si hay solicitudes pendientes o aceptadas en viajes que no terminaron;
//  3. el panel del administrador cuenta las encomiendas reales (solicitudes de tipo encomienda).
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool, query } from '../src/config/db.js'

const api = request(app)
const prefix = `qa-bdd-${randomUUID()}-`
const password = 'ClaveSegura-2026!'
const emails = new Set()
let seq = 0
let contacto = (Date.now() + 13) % 10000000

function datosContacto() {
  contacto += 1
  const dni = String(10000000 + (contacto % 89999999))
  return {
    dni,
    telefono: `351${String(1000000 + (contacto % 8999999))}`,
    verificacion: {
      consentimiento: true,
      dni_parcial: `****${dni.slice(-4)}`,
      resultado_ocr: 'legible',
      coincidencias: { nombre: true, apellido: true, dni: true },
      controles_faciales: { rostro_unico: true, parpadeo: true, giro: true, frente: true },
    },
  }
}

// Cliente o comisionista registrado por la API (crea también su fila en clientes/comisionistas).
async function registrar(rol) {
  const email = `${prefix}${rol}-${++seq}@example.test`
  emails.add(email)
  const ruta = rol === 'comisionista' ? 'register-comisionista' : 'register'
  const r = await api.post(`/api/auth/${ruta}`).send({
    nombre: 'Test', apellido: rol === 'cliente' ? 'Cliente' : 'Comisionista', email, password, confirmarPassword: password, ...datosContacto(),
  })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  await query('UPDATE usuarios SET email_verificado = true WHERE email = $1', [email])
  const login = await api.post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return { id: login.body.usuario.id, token: login.body.token, email }
}

// Los administradores no tienen registro público: se crean directo en la base.
async function crearAdmin() {
  const email = `${prefix}admin-${++seq}@example.test`
  emails.add(email)
  const { rows: [u] } = await query(
    `INSERT INTO usuarios (nombre, apellido, email, dni, password_hash, rol, email_verificado)
     VALUES ('Admin', 'Prueba', $1, $2, 'no-usado', 'administrador', true) RETURNING id`,
    [email, String(40000000 + (Date.now() % 9000000) + seq)],
  )
  return { id: u.id, email, token: jwt.sign({ id: u.id, email, rol: 'administrador' }, process.env.JWT_SECRET, { expiresIn: '1h' }) }
}

async function aprobarIdentidad(comisionistaId, adminId) {
  const { rows: [v] } = await query(
    `INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en, resuelta_en, resuelta_por)
     VALUES ($1, 'APROBADA_MANUALMENTE', NOW(), NOW(), $2) RETURNING id`,
    [comisionistaId, adminId],
  )
  return v.id
}

async function crearViaje(usuarioId, estado) {
  const { rows } = await query(
    `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, cupo_total, estado)
     VALUES ($1, 'Córdoba', 'Villa María', CURRENT_DATE, '08:00', '10:00', 3, $2) RETURNING id`,
    [usuarioId, estado],
  )
  return rows[0].id
}

async function crearSolicitud(viajeId, clienteUsuarioId, { tipo = 'pasajero', estado = 'pendiente', entregada = false } = {}) {
  const { rows: [c] } = await query('SELECT id FROM clientes WHERE usuario_id = $1', [clienteUsuarioId])
  const { rows } = await query(
    `INSERT INTO solicitudes_viaje (viaje_id, cliente_id, tipo, estado, origen_calle, origen_altura, destino_calle, destino_altura, cantidad_pasajeros, entregada_en)
     VALUES ($1, $2, $3, $4, 'Calle', '1', 'Calle', '2', $5, $6) RETURNING id`,
    [viajeId, c.id, tipo, estado, tipo === 'pasajero' ? 1 : null, entregada ? new Date() : null],
  )
  return rows[0].id
}

const auth = (u) => ({ Authorization: `Bearer ${u.token}` })
const existe = async (email) => (await query('SELECT 1 FROM usuarios WHERE email = $1', [email])).rowCount === 1

describe('fallas lógicas de la base de datos', () => {
  afterEach(async () => {
    if (emails.size) {
      await query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [Array.from(emails)])
      emails.clear()
    }
  })
  after(async () => { await pool.end() })

  describe('Falla 1: baja de un administrador que resolvió verificaciones', () => {
    it('borra la cuenta y la verificación conserva su estado y su fecha, sin quién la resolvió', async () => {
      const admin = await crearAdmin()
      const comisionista = await registrar('comisionista')
      const verificacionId = await aprobarIdentidad(comisionista.id, admin.id)

      const baja = await api.delete('/api/auth/perfil').set(auth(admin))
      assert.equal(baja.status, 200, JSON.stringify(baja.body))
      assert.equal(await existe(admin.email), false)

      const { rows: [v] } = await query('SELECT estado, resuelta_en, resuelta_por FROM verificaciones_identidad WHERE id = $1', [verificacionId])
      assert.equal(v.estado, 'APROBADA_MANUALMENTE')
      assert.ok(v.resuelta_en)
      assert.equal(v.resuelta_por, null)
    })

    it('sigue exigiendo la fecha de resolución en una verificación resuelta', async () => {
      const comisionista = await registrar('comisionista')
      await assert.rejects(
        query(`INSERT INTO verificaciones_identidad (usuario_id, estado, consentimiento_en) VALUES ($1, 'RECHAZADA', NOW())`, [comisionista.id]),
        /verificaciones_identidad_check/,
      )
    })
  })

  describe('Falla 2: la baja no se lleva datos de otras personas', () => {
    it('rechaza la baja del cliente con una solicitud pendiente en un viaje programado', async () => {
      const comisionista = await registrar('comisionista')
      const cliente = await registrar('cliente')
      const solicitudId = await crearSolicitud(await crearViaje(comisionista.id, 'programado'), cliente.id, { estado: 'pendiente' })

      const baja = await api.delete('/api/auth/perfil').set(auth(cliente))
      assert.equal(baja.status, 409, JSON.stringify(baja.body))
      assert.match(baja.body.mensaje, /solicitudes pendientes o aceptadas/)
      assert.equal(await existe(cliente.email), true)
      assert.equal((await query('SELECT 1 FROM solicitudes_viaje WHERE id = $1', [solicitudId])).rowCount, 1)
    })

    it('rechaza la baja del comisionista con una solicitud aceptada en su viaje en curso', async () => {
      const comisionista = await registrar('comisionista')
      await aprobarIdentidad(comisionista.id, comisionista.id)   // con identidad pendiente solo puede ver su perfil
      const cliente = await registrar('cliente')
      const viajeId = await crearViaje(comisionista.id, 'en_curso')
      await crearSolicitud(viajeId, cliente.id, { tipo: 'encomienda', estado: 'aceptada' })

      const baja = await api.delete('/api/auth/perfil').set(auth(comisionista))
      assert.equal(baja.status, 409, JSON.stringify(baja.body))
      assert.match(baja.body.mensaje, /tus viajes/)
      assert.equal(await existe(comisionista.email), true)
      assert.equal((await query('SELECT 1 FROM viajes WHERE id = $1', [viajeId])).rowCount, 1)
    })

    it('permite la baja cuando las solicitudes son de viajes terminados o ya no están activas', async () => {
      const comisionista = await registrar('comisionista')
      const cliente = await registrar('cliente')
      await crearSolicitud(await crearViaje(comisionista.id, 'finalizado'), cliente.id, { estado: 'aceptada' })
      await crearSolicitud(await crearViaje(comisionista.id, 'cancelado'), cliente.id, { estado: 'pendiente' })
      const programado = await crearViaje(comisionista.id, 'programado')
      await crearSolicitud(programado, cliente.id, { estado: 'cancelada' })
      await crearSolicitud(programado, cliente.id, { estado: 'rechazada' })

      const baja = await api.delete('/api/auth/perfil').set(auth(cliente))
      assert.equal(baja.status, 200, JSON.stringify(baja.body))
      assert.equal(await existe(cliente.email), false)
    })

    it('permite la baja una vez que el cliente cancela su solicitud', async () => {
      const comisionista = await registrar('comisionista')
      const cliente = await registrar('cliente')
      const solicitudId = await crearSolicitud(await crearViaje(comisionista.id, 'programado'), cliente.id, { estado: 'aceptada' })
      assert.equal((await api.delete('/api/auth/perfil').set(auth(cliente))).status, 409)

      await query(`UPDATE solicitudes_viaje SET estado = 'cancelada' WHERE id = $1`, [solicitudId])
      const baja = await api.delete('/api/auth/perfil').set(auth(cliente))
      assert.equal(baja.status, 200, JSON.stringify(baja.body))
      assert.equal(await existe(cliente.email), false)
    })

    it('permite la baja del comisionista sin solicitudes activas', async () => {
      const comisionista = await registrar('comisionista')
      await aprobarIdentidad(comisionista.id, comisionista.id)
      await crearViaje(comisionista.id, 'programado')
      const baja = await api.delete('/api/auth/perfil').set(auth(comisionista))
      assert.equal(baja.status, 200, JSON.stringify(baja.body))
      assert.equal(await existe(comisionista.email), false)
    })
  })

  describe('Falla 3: el panel del administrador cuenta las encomiendas reales', () => {
    it('cuenta las solicitudes de tipo encomienda y las muestra en la actividad', async () => {
      const admin = await crearAdmin()
      const comisionista = await registrar('comisionista')
      const cliente = await registrar('cliente')
      const contar = async () => (await api.get('/api/admin/resumen').set(auth(admin))).body.estadisticas

      const antes = await contar()
      const viajeId = await crearViaje(comisionista.id, 'en_curso')
      const pendiente = await crearSolicitud(viajeId, cliente.id, { tipo: 'encomienda', estado: 'pendiente' })
      await crearSolicitud(viajeId, cliente.id, { tipo: 'encomienda', estado: 'aceptada', entregada: true })
      await crearSolicitud(viajeId, cliente.id, { tipo: 'pasajero', estado: 'pendiente' })      // no es encomienda: no cuenta

      const r = await api.get('/api/admin/resumen').set(auth(admin))
      assert.equal(r.status, 200, JSON.stringify(r.body))
      const despues = r.body.estadisticas
      assert.equal(despues.encomiendas_total - antes.encomiendas_total, 2)
      assert.equal(despues.encomiendas_pendientes - antes.encomiendas_pendientes, 1)
      assert.equal(despues.encomiendas_entregadas - antes.encomiendas_entregadas, 1)

      const { rows: [real] } = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
                COUNT(*) FILTER (WHERE entregada_en IS NOT NULL)::int AS entregadas
         FROM solicitudes_viaje WHERE tipo = 'encomienda'`,
      )
      assert.deepEqual(
        [despues.encomiendas_total, despues.encomiendas_pendientes, despues.encomiendas_entregadas],
        [real.total, real.pendientes, real.entregadas],
      )

      const actividad = await api.get('/api/admin/actividad').set(auth(admin))
      assert.equal(actividad.status, 200, JSON.stringify(actividad.body))
      const lista = actividad.body.actividad ?? actividad.body.items ?? actividad.body
      assert.ok(Array.isArray(lista), JSON.stringify(actividad.body).slice(0, 300))
      const item = lista.find((a) => a.tipo === 'encomienda_registrada' && Number(a.referencia_id) === pendiente)
      assert.ok(item, 'la encomienda nueva aparece en la actividad del panel')
      assert.equal(item.detalle, `Encomienda #${pendiente}`)
      assert.equal(item.email, cliente.email)
    })
  })
})
