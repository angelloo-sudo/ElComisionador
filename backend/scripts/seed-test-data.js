import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localidades = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/localidades-cordoba.json'), 'utf8'))
const principales = ['matiasjofre6@hotmail.com', 'matiasjofre66@hotmail.com']
const nombres = ['Lucía', 'Mateo', 'Sofía', 'Benjamín', 'Valentina', 'Joaquín', 'Martina', 'Thiago', 'Camila', 'Lautaro', 'Catalina', 'Tomás', 'Agustina', 'Bautista', 'Julieta', 'Franco', 'Mía', 'Dante', 'Emilia', 'Facundo']
const apellidos = ['Gómez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Castro', 'Ortiz', 'Rojas', 'Molina']
const contenidos = ['electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro']
const pagos = ['efectivo', 'transferencia']
const fecha = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
const pickName = (i) => nombres[i % nombres.length]
const pickSurname = (i) => apellidos[Math.floor(i / 2) % apellidos.length]

if (!process.argv.includes('--reset')) {
  console.error('Ejecución detenida: para reemplazar los datos operativos locales use npm run seed:test -- --reset')
  process.exit(2)
}
if (process.env.DATABASE_URL || process.env.DB_NAME !== 'comitrack' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  console.error('Ejecución detenida: solo se permite la base comitrack en localhost, sin DATABASE_URL')
  process.exit(2)
}

const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
const client = await pool.connect()
const created = {}
let stage = 'conexión'
try {
  await client.query('BEGIN')
  await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE')
  const { rows: env } = await client.query(`SELECT current_database() AS db, inet_server_addr()::text AS addr, current_setting('port') AS port`)
  const serverAddress = String(env[0].addr ?? '').split('/')[0]
  if (env[0].db !== 'comitrack' || !['::1', '127.0.0.1'].includes(serverAddress)) throw new Error('La conexión no apunta a la base local autorizada')

  const { rows: roleCounts } = await client.query(`SELECT rol, COUNT(*)::int AS n FROM usuarios GROUP BY rol`)
  const roles = Object.fromEntries(roleCounts.map((r) => [r.rol, r.n]))
  if (!roles.cliente || !roles.comisionista) throw new Error('Faltan cuentas existentes de clientes o comisionistas; no se modificará la base')
  const { rows: mains } = await client.query(`SELECT u.id,u.email,u.rol,u.activo,c.id AS cliente_id FROM usuarios u LEFT JOIN clientes c ON c.usuario_id=u.id WHERE u.email=ANY($1) ORDER BY u.email`, [principales])
  if (mains.length !== 2 || mains.some((u) => u.rol !== 'cliente' || !u.activo || !u.cliente_id)) throw new Error('Las dos cuentas principales deben existir activas como clientes; no se modificará la base')

  const counts = await client.query(`SELECT 'viajes' AS t,count(*)::int n FROM viajes UNION ALL SELECT 'solicitudes_viaje',count(*)::int FROM solicitudes_viaje UNION ALL SELECT 'encomiendas',count(*)::int FROM encomiendas UNION ALL SELECT 'historial_encomiendas',count(*)::int FROM historial_encomiendas UNION ALL SELECT 'pasajeros',count(*)::int FROM pasajeros UNION ALL SELECT 'viaje_pasajero',count(*)::int FROM viaje_pasajero UNION ALL SELECT 'ingresos',count(*)::int FROM ingresos UNION ALL SELECT 'gastos',count(*)::int FROM gastos UNION ALL SELECT 'notificaciones',count(*)::int FROM notificaciones UNION ALL SELECT 'recordatorios_viaje',count(*)::int FROM recordatorios_viaje`)
  const deleted = Object.fromEntries(counts.rows.map((r) => [r.t, r.n]))
  stage = 'limpieza';
  await client.query(`DELETE FROM gastos; DELETE FROM ingresos; DELETE FROM notificaciones; DELETE FROM recordatorios_viaje; DELETE FROM solicitudes_viaje; DELETE FROM historial_encomiendas; DELETE FROM encomiendas; DELETE FROM viaje_pasajero; DELETE FROM pasajeros; DELETE FROM viajes`)

  const { rows: users } = await client.query(`SELECT u.id,u.rol,c.id AS cliente_id,m.precio_km FROM usuarios u LEFT JOIN clientes c ON c.usuario_id=u.id LEFT JOIN comisionistas m ON m.usuario_id=u.id WHERE u.activo=true ORDER BY u.id`)
  let customerUsers = [...new Map(users.filter((u) => u.rol === 'cliente' && u.cliente_id).map((u) => [u.cliente_id, u])).values()]
  const hash = await bcrypt.hash('ComiTrackDemo2026!', 10)
  let nextDni = 42000000
  while (customerUsers.length < 50) {
    const i = customerUsers.length + 1
    const email = `seed.cliente${String(i).padStart(2, '0')}@comitrack.test`
    const exists = await client.query('SELECT id FROM usuarios WHERE email=$1', [email])
    if (exists.rowCount) {
      const u = await client.query(`SELECT u.id,c.id AS cliente_id FROM usuarios u JOIN clientes c ON c.usuario_id=u.id WHERE u.email=$1 AND u.rol='cliente'`, [email])
      if (!u.rowCount) throw new Error(`El correo reservado ${email} ya existe con otro perfil`)
      customerUsers.push({ ...u.rows[0], rol: 'cliente' }); continue
    }
    const n = customerUsers.length
    const dni = String(980000000 + nextDni++)
    const user = await client.query(`INSERT INTO usuarios(nombre,apellido,email,dni,password_hash,rol,activo,email_verificado) VALUES($1,$2,$3,$4,$5,'cliente',true,true) RETURNING id`, [pickName(n), pickSurname(n), email, dni, hash])
    const profile = await client.query(`INSERT INTO clientes(usuario_id,dni,telefono) VALUES($1,$2,$3) RETURNING id`, [user.rows[0].id, dni, `+54 9 351 5${String(100000 + n).slice(-6)}`])
    customerUsers.push({ id: user.rows[0].id, cliente_id: profile.rows[0].id, rol: 'cliente' })
  }
  created.clientes = 50

  const commissioners = [...new Set(users.filter((u) => u.rol === 'comisionista').map((u) => u.id))]
  if (!commissioners.length) throw new Error('No hay comisionistas disponibles')
  for (const uid of commissioners) {
    await client.query(`UPDATE comisionistas SET precio_km=COALESCE(precio_km,$2) WHERE usuario_id=$1`, [uid, 200 + (uid % 7) * 35])
    for (const [name, desc] of [['Combustible', 'Carga de combustible'], ['Mantenimiento', 'Mantenimiento del vehículo'], ['Peajes', 'Peajes y estacionamiento']]) {
      await client.query(`INSERT INTO tipos_gasto(usuario_id,nombre,descripcion) VALUES($1,$2,$3) ON CONFLICT (usuario_id,lower(nombre)) DO NOTHING`, [uid, name, desc])
    }
  }

  stage = 'viajes';
  const routes = []
  for (let i = 0; i < 50; i++) {
    const a = localidades[(i * 7 + 1) % localidades.length]
    let b = localidades[(i * 13 + 41) % localidades.length]
    if (a === b) b = localidades[(i * 13 + 42) % localidades.length]
    routes.push([a, b])
  }
  const tripRows = []
  for (let i = 0; i < 50; i++) {
    const owner = commissioners[i % commissioners.length]
    const state = i < 25 ? 'finalizado' : i < 28 ? 'cancelado' : i < 30 ? 'en_curso' : 'programado'
    const dayOffset = state === 'finalizado' ? -1 - (i % 12) : state === 'en_curso' ? 0 : state === 'cancelado' ? 4 + i : 2 + (i % 28)
    const km = 25 + (i * 37 % 420)
    const startHour = 7 + (i % 12)
    const trip = await client.query(`INSERT INTO viajes(usuario_id,origen,destino,fecha,hora_salida,hora_llegada,distancia_km,duracion_min,cupo_total,estado,iniciado_en,finalizado_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::varchar,CASE WHEN $10::text IN ('en_curso','finalizado') THEN NOW()-INTERVAL '2 hours' END,CASE WHEN $10::text='finalizado' THEN NOW()-INTERVAL '1 hour' END) RETURNING id`, [owner, routes[i][0], routes[i][1], fecha(dayOffset), `${String(startHour).padStart(2,'0')}:00`, `${String((startHour + 3) % 24).padStart(2,'0')}:00`, km, 60 + km, 3 + i % 4, state])
    tripRows.push({ id: trip.rows[0].id, owner, state, origin: routes[i][0], dest: routes[i][1], km })
    if (state === 'programado' && i % 3 === 0) await client.query(`INSERT INTO recordatorios_viaje(viaje_id,minutos_anticipacion,programado_para) VALUES($1,60,($2::date+TIME '07:00')::timestamptz)`, [tripRows[i].id, fecha(dayOffset)])
  }
  created.viajes = 50

  stage = 'solicitudes';
  const clientProfiles = customerUsers.map((u) => u.cliente_id)
  const solicitudRows = []
  for (const type of ['pasajero', 'encomienda']) {
    for (let i = 0; i < 50; i++) {
      const trip = tripRows[i]
      const customer = clientProfiles[(i + (type === 'pasajero' ? 0 : 1)) % clientProfiles.length]
      const state = i < 25 ? 'aceptada' : i < 30 ? 'cancelada' : ['pendiente', 'cancelada', 'rechazada'][i % 3]
      const accepted = state === 'aceptada'
      const isPass = type === 'pasajero'
      const amount = Math.round((trip.km * 200 + (i % 8) * 125) * (isPass ? 1 + i % 2 : 0.55))
      const personIndex = i
      const req = await client.query(`INSERT INTO solicitudes_viaje(viaje_id,cliente_id,tipo,estado,origen_calle,origen_altura,origen_codigo_postal,destino_calle,destino_altura,destino_codigo_postal,nombre,apellido,dni,telefono,cantidad_pasajeros,forma_pago,peso_kg,ancho_cm,largo_cm,fragil,tipo_contenido,contenido_descripcion,emisor_nombre,emisor_apellido,emisor_telefono,receptor_nombre,receptor_apellido,receptor_telefono,origen_localidad,destino_localidad,distancia_km,precio_km,monto,resuelto_en,estado_pasajero,subio_en,llego_en,retirada_en,entregada_en) VALUES($1,$2,$3::varchar,$4::varchar,$5,$6,'5000',$7,$8,'5000',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$9,$10,$12,$21,$22,$23,$24,$25,$26,200,$27,CASE WHEN $4::text <> 'pendiente' THEN NOW()-INTERVAL '1 day' END,CASE WHEN $3::text='pasajero' AND $4::text='aceptada' AND $28 THEN 'en_destino' END,CASE WHEN $3::text='pasajero' AND $4::text='aceptada' AND $28 THEN NOW()-INTERVAL '3 hours' END,CASE WHEN $3::text='pasajero' AND $4::text='aceptada' AND $28 THEN NOW()-INTERVAL '1 hour' END,CASE WHEN $3::text='encomienda' AND $4::text='aceptada' THEN NOW()-INTERVAL '2 hours' END,CASE WHEN $3::text='encomienda' AND $4::text='aceptada' AND $29 THEN NOW()-INTERVAL '1 hour' END) RETURNING id`, [trip.id, customer, type, state, 'Av. Colón', 100 + i * 11, 'Av. Vélez Sarsfield', 200 + i * 7, pickName(personIndex), pickSurname(personIndex), String(30000000 + i * 17), `+54 9 351 4${String(100000 + i).slice(-6)}`, isPass ? 1 : null, pagos[i % 2], isPass ? null : 0.5 + i % 15, isPass ? null : 20 + i % 60, isPass ? null : 20 + i % 80, isPass ? null : i % 3 === 0, isPass ? null : contenidos[i % contenidos.length], isPass ? null : `Paquete de prueba ${i + 1}`, pickName(i + 7), pickSurname(i + 7), `+54 9 351 7${String(120000 + i).slice(-6)}`, trip.origin, trip.dest, trip.km, amount, i < 25 || i % 7 !== 0, i < 25 || i % 7 === 1])
      solicitudRows.push({ id: req.rows[0].id, trip, customer, type, state, amount, i })
    }
  }
  created.solicitudes_pasajero = 50
  created.solicitudes_encomienda = 50

  stage = 'encomiendas';
  let packageCount = 0
  const packageByState = { aceptada: 'aceptado', pendiente: 'pendiente', cancelada: 'cancelada', rechazada: 'cancelada' }
  for (const s of solicitudRows.filter((r) => r.type === 'encomienda')) {
    const state = packageByState[s.state]
    const result = await client.query(`INSERT INTO encomiendas(viaje_id,cliente_remitente_id,remitente_nombre,remitente_telefono,direccion_retiro,destinatario_nombre,destinatario_telefono,destinatario_direccion,tipo_contenido,peso_kg,dimensiones,tamano,fragil,descripcion,monto_flete,estado,estado_pago,fecha_solicitud,retirado_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::varchar,$17,NOW()-($18||' days')::interval,CASE WHEN $16::text IN ('retirado','recibido','en_viaje','entregado') THEN NOW()-INTERVAL '2 hours' END) RETURNING id`, [s.trip.id, s.customer, pickName(s.i), `+54 9 351 4${String(100000+s.i).slice(-6)}`, 'Av. Colón 100', `${pickName(s.i+2)} ${pickSurname(s.i+2)}`, `+54 9 351 8${String(200000+s.i).slice(-6)}`, `Calle ${100+s.i} ${s.trip.dest}`, contenidos[s.i % contenidos.length], 0.5+s.i%15, ['0.5x0.5','1x1','2x2'][s.i%3], ['pequeno','mediano','grande'][s.i%3], s.i%3===0, `Encomienda de prueba #${s.i+1}`, s.amount, state, state === 'entregado' ? 'pagado' : 'pendiente', String(s.i%20)])
    packageCount++
    const { rows: packageRows } = result
    // Estados terminales representan distintas etapas reales; el trigger conserva cada transición.
    if (s.state === 'aceptada') {
      const sequence = ['aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado']
      for (const next of sequence) await client.query(`UPDATE encomiendas SET estado=$2::varchar, estado_pago=CASE WHEN $2::text='entregado' THEN 'pagado' ELSE estado_pago END WHERE id=$1`, [packageRows[0].id, next])
    }
  }
  created.encomiendas = packageCount

  // Un ingreso por cada solicitud aceptada: pasajero que llegó a destino o paquete retirado.
  stage = 'ingresos';
  const paid = solicitudRows.filter((s) => s.state === 'aceptada' && s.i < 25)
  for (const s of paid) {
    await client.query(`INSERT INTO ingresos(viaje_id,usuario_id,solicitud_id,tipo_servicio,concepto,monto,fecha,forma_pago,estado) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'activo')`, [s.trip.id, s.trip.owner, s.id, s.type, `${s.type === 'pasajero' ? 'Pasaje' : 'Encomienda'} · ${s.trip.origin} → ${s.trip.dest}`, s.amount, fecha(-1 - s.i % 30), pagos[s.i % 2]])
  }
  created.ingresos = paid.length

  stage = 'gastos';
  const { rows: types } = await client.query(`SELECT id,usuario_id FROM tipos_gasto WHERE nombre IN ('Combustible','Mantenimiento','Peajes') ORDER BY id`)
  for (let i = 0; i < 50; i++) {
    const trip = tripRows[i]
    const type = types.find((t) => t.usuario_id === trip.owner)
    await client.query(`INSERT INTO gastos(viaje_id,usuario_id,tipo_gasto_id,categoria,monto,fecha,descripcion) VALUES($1,$2,$3,$4,$5,$6,$7)`, [trip.id, trip.owner, type.id, ['combustible','mantenimiento','peaje'][i%3], 1500 + (i*739)%48000, fecha(-1-i%90), `Gasto operativo de prueba #${i+1}`])
  }
  created.gastos = 50

  stage = 'notificaciones';
  for (let i = 0; i < 50; i++) {
    const customer = customerUsers[i % customerUsers.length]
    await client.query(`INSERT INTO notificaciones(usuario_id,viaje_id,titulo,mensaje,leida_en,creado_en) VALUES($1,$2,$3,$4,CASE WHEN $5 THEN NOW()-INTERVAL '1 day' END,NOW()-($6||' hours')::interval)`, [customer.id, tripRows[i].id, i%2 ? 'Actualización de viaje' : 'Nueva actividad', i%2 ? `Hay novedades sobre tu viaje ${tripRows[i].origin} → ${tripRows[i].dest}.` : 'Tu actividad de prueba se actualizó.', i%3===0, String(i+1)])
  }
  created.notificaciones = 50

  const { rows: mainVerification } = await client.query(`SELECT u.email,u.rol,u.activo,c.id AS cliente_id,COUNT(s.id)::int AS solicitudes,COUNT(DISTINCT v.id)::int AS viajes,COUNT(DISTINCT s.tipo)::int AS tipos FROM usuarios u JOIN clientes c ON c.usuario_id=u.id LEFT JOIN solicitudes_viaje s ON s.cliente_id=c.id LEFT JOIN viajes v ON v.id=s.viaje_id WHERE u.email=ANY($1) GROUP BY u.email,u.rol,u.activo,c.id ORDER BY u.email`, [principales])
  if (mainVerification.length !== 2 || mainVerification.some((u) => u.solicitudes < 2 || u.tipos !== 2)) throw new Error('Falló la comprobación de actividad de las cuentas principales')
  await client.query('COMMIT')
  console.log(JSON.stringify({ database: env[0], deleted, created, preservedAccounts: mainVerification.map(({ email, rol, activo, solicitudes, viajes, tipos }) => ({ email, rol, activo, solicitudes, viajes, tiposSolicitud: tipos })), syntheticLogin: { emailPattern: 'seed.clienteNN@comitrack.test', password: 'ComiTrackDemo2026!' } }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(`Seed revertido en ${stage}; no quedaron cambios parciales: ${error.message}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
