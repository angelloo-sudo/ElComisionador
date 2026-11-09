// Datos aditivos, idempotentes y acotados para las dos cuentas de prueba indicadas.
// Uso: node scripts/seed-cuentas-demo.js --inspect | --apply
import 'dotenv/config'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { pool as appPool } from '../src/config/db.js'
import { crearDatosSnapshotRentabilidad } from '../src/services/reportes-rentabilidad.service.js'

const { Pool } = pg
const CUENTAS = {
  comisionista: { email: 'matiasjofree66@hotmail.com', rol: 'comisionista' },
  cliente: { email: 'matiasjofre6@hotmail.com', rol: 'cliente' },
}
const TAG = 'DEMO-COMITRACK-CUENTAS-2026'
const TRIPS = [
  { serie: 'd0000000-0000-4000-8000-000000000001', origen: 'Córdoba', destino: 'Villa María', fecha: '2026-09-04', salida: '07:30', llegada: '11:30', km: 150, estado: 'finalizado', paradas: [['Oncativo', '09:00'], ['Oliva', '10:00']] },
  { serie: 'd0000000-0000-4000-8000-000000000002', origen: 'Córdoba', destino: 'Río Cuarto', fecha: '2026-09-12', salida: '07:00', llegada: '12:30', km: 220, estado: 'finalizado', paradas: [['Alta Gracia', '08:30'], ['Almafuerte', '10:00']] },
  { serie: 'd0000000-0000-4000-8000-000000000003', origen: 'Villa María', destino: 'Córdoba', fecha: '2026-10-08', salida: '08:00', llegada: '12:00', km: 150, estado: 'finalizado', paradas: [] },
  { serie: 'd0000000-0000-4000-8000-000000000004', origen: 'Córdoba', destino: 'Alta Gracia', fecha: '2026-10-21', salida: '09:00', llegada: '10:30', km: 40, estado: 'finalizado', paradas: [['Despeñaderos', '09:45']] },
  { serie: 'd0000000-0000-4000-8000-000000000005', origen: 'Córdoba', destino: 'San Francisco', fecha: '2026-10-29', salida: '07:00', llegada: '11:00', km: 210, estado: 'cancelado', paradas: [] },
  { serie: 'd0000000-0000-4000-8000-000000000006', origen: 'Córdoba', destino: 'Villa Carlos Paz', fecha: '2026-11-20', salida: '09:00', llegada: '10:15', km: 40, estado: 'programado', paradas: [['La Calera', '09:30']] },
]
const PASAJEROS = [
  { trip: 0, estado: 'aceptada', operacion: 'en_destino', desde: 'Córdoba', hasta: 'Oliva', monto: 18000 },
  { trip: 1, estado: 'aceptada', operacion: 'en_destino', desde: 'Alta Gracia', hasta: 'Río Cuarto', monto: 24000 },
  { trip: 2, estado: 'aceptada', operacion: 'en_destino', desde: 'Villa María', hasta: 'Córdoba', monto: 20000 },
  { trip: 3, estado: 'aceptada', operacion: 'en_destino', desde: 'Córdoba', hasta: 'Alta Gracia', monto: 12000 },
  { trip: 4, estado: 'cancelada', operacion: null, desde: 'Córdoba', hasta: 'San Francisco', monto: 28000 },
  { trip: 5, estado: 'pendiente', operacion: null, desde: 'La Calera', hasta: 'Villa Carlos Paz', monto: 8000 },
]
const PAQUETES = [
  { trip: 0, estado: 'aceptada', retiro: true, desde: 'Oncativo', hasta: 'Villa María' },
  { trip: 1, estado: 'aceptada', retiro: true, desde: 'Córdoba', hasta: 'Almafuerte' },
  { trip: 2, estado: 'aceptada', retiro: true, desde: 'Villa María', hasta: 'Córdoba' },
  { trip: 3, estado: 'aceptada', retiro: true, desde: 'Despeñaderos', hasta: 'Alta Gracia' },
  { trip: 4, estado: 'cancelada', retiro: false, desde: 'Córdoba', hasta: 'San Francisco' },
  { trip: 5, estado: 'pendiente', retiro: false, desde: 'Córdoba', hasta: 'La Calera' },
]
const REPORTES = [
  ['2026-09-01', '2026-09-30', 'cuentas-2026-09'],
  ['2026-10-01', '2026-10-31', 'cuentas-2026-10'],
  ['2026-11-01', '2026-11-05', 'cuentas-2026-11-vacio'],
  ['2026-09-01', '2026-10-31', 'cuentas-2026-q3q4'],
  ['2026-10-21', '2026-10-31', 'cuentas-2026-10-segunda-quincena-negativo'],
  ['2025-01-01', '2025-01-31', 'cuentas-2025-vacio'],
]

function exigirEntornoLocal() {
  if (process.env.DATABASE_URL || process.env.DB_NAME !== 'comitrack' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
    throw new Error('Se detuvo: la configuración no apunta explícitamente a comitrack en localhost sin DATABASE_URL')
  }
}

async function exigirEstructura(db) {
  const requeridas = {
    usuarios: ['id', 'email', 'rol', 'activo'], clientes: ['id', 'usuario_id'], comisionistas: ['usuario_id'],
    viajes: ['id', 'usuario_id', 'serie_id', 'origen', 'destino', 'fecha', 'hora_salida', 'hora_llegada', 'distancia_km', 'duracion_min', 'cupo_total', 'estado', 'iniciado_en', 'finalizado_en'],
    paradas_viaje: ['id', 'viaje_id', 'orden', 'localidad', 'hora_estimada'], solicitudes_viaje: ['id', 'viaje_id', 'cliente_id', 'tipo', 'estado', 'origen_calle', 'origen_altura', 'destino_calle', 'destino_altura', 'origen_codigo_postal', 'destino_codigo_postal', 'nombre', 'apellido', 'dni', 'telefono', 'cantidad_pasajeros', 'forma_pago', 'peso_kg', 'ancho_cm', 'largo_cm', 'emisor_nombre', 'emisor_apellido', 'emisor_telefono', 'receptor_nombre', 'receptor_apellido', 'receptor_telefono', 'fragil', 'tipo_contenido', 'contenido_descripcion', 'origen_localidad', 'destino_localidad', 'monto', 'resuelto_en', 'estado_pasajero', 'subio_en', 'llego_en', 'retirada_en', 'entregada_en'],
    historial_solicitudes_encomienda: ['id', 'solicitud_id', 'estado', 'fecha_hora'], encomiendas: ['id', 'viaje_id', 'cliente_remitente_id', 'remitente_nombre', 'remitente_telefono', 'direccion_retiro', 'destinatario_nombre', 'destinatario_telefono', 'destinatario_direccion', 'tipo_contenido', 'peso_kg', 'dimensiones', 'tamano', 'fragil', 'descripcion', 'monto_flete', 'estado', 'estado_pago', 'fecha_solicitud', 'retirado_en'], historial_encomiendas: ['id', 'encomienda_id', 'estado', 'fecha_hora'],
    ingresos: ['id', 'viaje_id', 'usuario_id', 'solicitud_id', 'concepto', 'monto', 'fecha', 'forma_pago', 'estado'], tipos_gasto: ['id', 'usuario_id', 'nombre'], gastos: ['id', 'viaje_id', 'usuario_id', 'tipo_gasto_id', 'categoria', 'monto', 'fecha', 'descripcion'],
    verificaciones_identidad: ['id', 'usuario_id', 'estado', 'consentimiento_en', 'dni_parcial', 'resultado_ocr', 'coincidencias', 'controles_faciales'], reportes_rentabilidad: ['id', 'usuario_id', 'periodo_desde', 'periodo_hasta', 'generado_en', 'total_ingresos', 'total_gastos', 'resultado_economico', 'version_snapshot', 'datos_snapshot'],
  }
  const { rows } = await db.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [Object.keys(requeridas)])
  const columnas = new Map()
  for (const row of rows) columnas.set(row.table_name, (columnas.get(row.table_name) ?? new Set()).add(row.column_name))
  const faltantes = Object.entries(requeridas).flatMap(([tabla, campos]) => campos.filter((campo) => !columnas.get(tabla)?.has(campo)).map((campo) => `${tabla}.${campo}`))
  if (faltantes.length) throw new Error(`Estructura real incompleta; no se modificará la base. Faltan: ${faltantes.join(', ')}`)
  return Object.keys(requeridas).length
}

async function cuentaDemo(db, reporte) {
  const { rows } = await db.query(reporte)
  return Number(rows[0].n)
}

async function main() {
  exigirEntornoLocal()
  const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
  const db = await pool.connect()
  let stage = 'preflight'
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(746211504)')
    const { rows: [target] } = await db.query('SELECT current_database() AS database, inet_server_addr()::text AS address, current_setting(\'port\') AS port')
    if (target.database !== 'comitrack' || !['127.0.0.1', '::1'].includes(String(target.address ?? '').split('/')[0])) throw new Error('La conexión no apunta a la instancia local autorizada')
    const tableCount = await exigirEstructura(db)
    const { rows: users } = await db.query(`SELECT u.id, u.email, u.rol, u.activo, c.id AS cliente_id, m.usuario_id AS comisionista_id, m.precio_km FROM usuarios u LEFT JOIN clientes c ON c.usuario_id=u.id LEFT JOIN comisionistas m ON m.usuario_id=u.id WHERE u.email=ANY($1::text[]) ORDER BY u.email`, [[CUENTAS.cliente.email, CUENTAS.comisionista.email]])
    const { rows: roleMismatch } = await db.query(`SELECT email,rol FROM usuarios WHERE email=ANY($1::text[]) AND rol <> ALL($2::text[])`, [[CUENTAS.cliente.email, CUENTAS.comisionista.email], ['cliente', 'comisionista']])
    const expected = new Map(users.map((u) => [u.email, u]))
    const accountIssues = [CUENTAS.cliente, CUENTAS.comisionista].flatMap(({ email, rol }) => {
      const user = expected.get(email)
      if (!user) return [`no existe ${email}`]
      if (user.rol !== rol) return [`${email} tiene rol ${user.rol}, se esperaba ${rol}`]
      if (!user.activo) return [`${email} está inactiva`]
      if (rol === 'cliente' && !user.cliente_id) return [`${email} no tiene ficha de cliente`]
      if (rol === 'comisionista' && !user.comisionista_id) return [`${email} no tiene ficha de comisionista`]
      return []
    })
    if (roleMismatch.length) accountIssues.push(...roleMismatch.map((u) => `${u.email} tiene rol inesperado ${u.rol}`))
    if (accountIssues.length) throw new Error(`Cuentas inválidas; no se crearon usuarios ni datos: ${accountIssues.join('; ')}`)
    const cliente = expected.get(CUENTAS.cliente.email)
    const comisionista = expected.get(CUENTAS.comisionista.email)
    const { rows: countsBefore } = await db.query(`SELECT (SELECT count(*)::int FROM viajes WHERE usuario_id=$1) AS viajes, (SELECT count(*)::int FROM solicitudes_viaje WHERE cliente_id=$2) AS solicitudes, (SELECT count(*)::int FROM encomiendas WHERE cliente_remitente_id=$3) AS encomiendas, (SELECT count(*)::int FROM ingresos WHERE usuario_id=$1) AS ingresos, (SELECT count(*)::int FROM gastos WHERE usuario_id=$1) AS gastos, (SELECT count(*)::int FROM reportes_rentabilidad WHERE usuario_id=$1) AS reportes, (SELECT count(*)::int FROM verificaciones_identidad WHERE usuario_id IN ($1,$2)) AS verificaciones`, [comisionista.id, cliente.id, cliente.cliente_id])
    if (process.argv.includes('--inspect')) {
      const { rows: constraints } = await db.query(`SELECT t.relname AS tabla, c.conname AS nombre, pg_get_constraintdef(c.oid) AS definicion FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname=ANY($1::text[]) ORDER BY t.relname,c.contype,c.conname`, [Object.keys({ viajes: 1, paradas_viaje: 1, solicitudes_viaje: 1, historial_solicitudes_encomienda: 1, encomiendas: 1, historial_encomiendas: 1, ingresos: 1, tipos_gasto: 1, gastos: 1, verificaciones_identidad: 1, reportes_rentabilidad: 1 })])
      await db.query('ROLLBACK')
      console.log(JSON.stringify({ target, tablesInspected: tableCount, constraints, accounts: users.map(({ email, rol, activo, cliente_id, comisionista_id }) => ({ email, rol, activo, tieneFichaCliente: Boolean(cliente_id), tieneFichaComisionista: Boolean(comisionista_id) })), countsBefore: countsBefore[0], noWrites: true }, null, 2))
      return
    }
    if (process.argv.includes('--verify')) {
      const verificationQueries = []
      verificationQueries.push(await db.query(`SELECT (SELECT count(*)::int FROM viajes WHERE serie_id=ANY($1::uuid[])) AS viajes, (SELECT count(*)::int FROM paradas_viaje p JOIN viajes v ON v.id=p.viaje_id WHERE v.serie_id=ANY($1::uuid[])) AS paradas, (SELECT count(*)::int FROM solicitudes_viaje WHERE cliente_id=$2 AND origen_descripcion LIKE $3) AS reservas, (SELECT count(*)::int FROM solicitudes_viaje WHERE cliente_id=$2 AND contenido_descripcion LIKE $3) AS solicitudesEncomienda, (SELECT count(*)::int FROM encomiendas WHERE cliente_remitente_id=$4 AND descripcion LIKE $3) AS encomiendas, (SELECT count(*)::int FROM ingresos WHERE usuario_id=$5 AND concepto LIKE $3) AS ingresos, (SELECT count(*)::int FROM gastos WHERE usuario_id=$5 AND descripcion LIKE $3) AS gastos, (SELECT count(*)::int FROM reportes_rentabilidad WHERE usuario_id=$5 AND COALESCE(datos_snapshot->>'demo_code','') LIKE 'cuentas-%') AS reportes, (SELECT count(*)::int FROM verificaciones_identidad WHERE usuario_id=ANY($6::int[]) AND dni_parcial IN ('••••9901','••••9902')) AS verificaciones`, [TRIPS.map((t) => t.serie), cliente.cliente_id, `${TAG}%`, cliente.cliente_id, comisionista.id, [cliente.id, comisionista.id]]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS reportes, count(*) FILTER (WHERE (total_ingresos-total_gastos)>0)::int AS positivos, count(*) FILTER (WHERE (total_ingresos-total_gastos)<0)::int AS negativos, count(*) FILTER (WHERE (total_ingresos-total_gastos)=0)::int AS equilibrados, json_agg(json_build_object('desde',periodo_desde,'hasta',periodo_hasta,'ingresos',total_ingresos,'gastos',total_gastos,'resultado',resultado_economico) ORDER BY periodo_desde,periodo_hasta) AS detalle FROM reportes_rentabilidad WHERE usuario_id=$1 AND datos_snapshot->>'demo_code' LIKE 'cuentas-%'`, [comisionista.id]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS viajes_sobre_cupo FROM viajes v WHERE v.serie_id=ANY($1::uuid[]) AND (SELECT COALESCE(sum(s.cantidad_pasajeros),0) FROM solicitudes_viaje s WHERE s.viaje_id=v.id AND s.estado IN ('pendiente','aceptada') AND COALESCE(s.estado_pasajero,'') NOT IN ('ausente','cancelado_comisionista')) > v.cupo_total`, [TRIPS.map((t) => t.serie)]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS relaciones_incorrectas FROM solicitudes_viaje s JOIN viajes v ON v.id=s.viaje_id JOIN clientes c ON c.id=s.cliente_id WHERE (s.origen_descripcion LIKE $1 OR s.contenido_descripcion LIKE $1) AND (v.usuario_id<>$2 OR c.usuario_id<>$3)`, [`${TAG}%`, comisionista.id, cliente.id]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS relaciones_financieras_incorrectas FROM ingresos i LEFT JOIN viajes v ON v.id=i.viaje_id LEFT JOIN solicitudes_viaje s ON s.id=i.solicitud_id WHERE i.concepto LIKE $1 AND (i.usuario_id<>$2 OR (i.viaje_id IS NOT NULL AND v.usuario_id<>$2) OR (i.solicitud_id IS NOT NULL AND (s.id IS NULL OR s.viaje_id<>i.viaje_id)))`, [`${TAG}%`, comisionista.id]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS "historialEncomiendas" FROM historial_encomiendas h JOIN encomiendas e ON e.id=h.encomienda_id WHERE e.descripcion LIKE $1`, [`${TAG}-PAQUETE-%`]))
      verificationQueries.push(await db.query(`SELECT count(*)::int AS "historialSolicitudes" FROM historial_solicitudes_encomienda h JOIN solicitudes_viaje s ON s.id=h.solicitud_id WHERE s.contenido_descripcion LIKE $1`, [`${TAG}-ENV-%`]))
      const counts = verificationQueries[0].rows[0]
      const reports = verificationQueries[1].rows[0]
      const capacities = verificationQueries[2].rows[0]
      const ownership = verificationQueries[3].rows[0]
      const finances = verificationQueries[4].rows[0]
      const packageHistory = verificationQueries[5].rows[0]
      const requestHistory = verificationQueries[6].rows[0]
      const failures = []
      for (const [name, min] of [['viajes', 6], ['paradas', 6], ['reservas', 6], ['solicitudesEncomienda', 6], ['encomiendas', 6], ['ingresos', 5], ['gastos', 5], ['reportes', 5], ['verificaciones', 1]]) if (Number(counts[name]) < min) failures.push(`${name}: se esperaban al menos ${min}, hay ${counts[name]}`)
      if (Number(reports.positivos) < 1 || Number(reports.negativos) < 1 || Number(reports.equilibrados) < 1) failures.push('Los reportes no cubren resultado positivo, negativo y equilibrado')
      if (Number(capacities.viajes_sobre_cupo)) failures.push('Hay viajes demo sobre su capacidad')
      if (Number(ownership.relaciones_incorrectas) || Number(finances.relaciones_financieras_incorrectas)) failures.push('Hay relaciones con propietario o entidad incorrectos')
      if (!Number(packageHistory.historialEncomiendas) || !Number(requestHistory.historialSolicitudes)) failures.push('Falta historial de cambios para las encomiendas demo')
      await db.query('ROLLBACK')
      let accesoApi
      try {
        const token = (user) => `Bearer ${jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '5m' })}`
        const apiChecks = await Promise.all([
          request(app).get('/api/solicitudes/mias').set('Authorization', token(cliente)),
          request(app).get('/api/solicitudes/recibidas?estado=todas').set('Authorization', token(comisionista)),
          request(app).get('/api/finanzas/gastos').set('Authorization', token(cliente)),
          request(app).get('/api/solicitudes/mias').set('Authorization', token(comisionista)),
        ])
        accesoApi = { solicitudesPropiasCliente: apiChecks[0].status === 200 && Array.isArray(apiChecks[0].body) && apiChecks[0].body.length >= 12, solicitudesDelComisionista: apiChecks[1].status === 200 && Array.isArray(apiChecks[1].body) && apiChecks[1].body.length >= 12, clienteBloqueadoDeFinanzas: apiChecks[2].status === 403, comisionistaBloqueadoDeSolicitudesDeCliente: apiChecks[3].status === 403 }
        if (Object.values(accesoApi).some((ok) => !ok)) failures.push('Falló una comprobación de acceso por cuenta/rol de solo lectura')
      } finally { await appPool.end() }
      console.log(JSON.stringify({ target, cuentas: users.map(({ email, rol }) => ({ email, rol })), registrosDemo: counts, resumenReportes: reports, historialEncomiendas: packageHistory.historialEncomiendas, historialSolicitudesEncomienda: requestHistory.historialSolicitudes, viajesSobreCupo: capacities.viajes_sobre_cupo, reservasConPropietarioIncorrecto: ownership.relaciones_incorrectas, ingresosConRelacionesIncorrectas: finances.relaciones_financieras_incorrectas, accesoApi, noWrites: true, verificaciones: failures.length ? 'fallidas' : 'correctas', fallos: failures }, null, 2))
      if (failures.length) process.exitCode = 1
      return
    }
    if (!process.argv.includes('--apply')) throw new Error('Usá --inspect para solo revisar o --apply para cargar los registros identificables')

    stage = 'viajes'
    const tripIds = []
    for (const [i, trip] of TRIPS.entries()) {
      let { rows } = await db.query('SELECT id, usuario_id, origen, destino, fecha::text, estado FROM viajes WHERE serie_id=$1', [trip.serie])
      if (rows.length > 1) throw new Error(`serie_id de demostración duplicado: ${trip.serie}`)
      if (!rows.length) {
        const { rows: inserted } = await db.query(`INSERT INTO viajes(usuario_id,origen,destino,fecha,hora_salida,hora_llegada,distancia_km,duracion_min,serie_id,cupo_total,estado,iniciado_en,finalizado_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,4,$10::varchar,CASE WHEN $11 THEN $4::date+$5::time END,CASE WHEN $12 THEN $4::date+$6::time END) RETURNING id`, [comisionista.id, trip.origen, trip.destino, trip.fecha, trip.salida, trip.llegada, trip.km, Math.round(trip.km * 1.15), trip.serie, trip.estado, trip.estado === 'finalizado', ['finalizado', 'cancelado'].includes(trip.estado)])
        rows = inserted
      } else if (Number(rows[0].usuario_id) !== comisionista.id || rows[0].origen !== trip.origen || rows[0].destino !== trip.destino || rows[0].fecha !== trip.fecha || rows[0].estado !== trip.estado) {
        throw new Error(`El identificador ${trip.serie} existe con datos distintos; no se alterará`)
      }
      const tripId = rows[0].id
      tripIds.push(tripId)
      const { rows: stops } = await db.query('SELECT orden, localidad, hora_estimada::text FROM paradas_viaje WHERE viaje_id=$1 ORDER BY orden', [tripId])
      if (!stops.length && trip.paradas.length) {
        for (const [j, [localidad, hora]] of trip.paradas.entries()) await db.query('INSERT INTO paradas_viaje(viaje_id,orden,localidad,hora_estimada) VALUES($1,$2,$3,$4)', [tripId, j + 1, localidad, hora])
      } else if (JSON.stringify(stops.map((p) => [Number(p.orden), p.localidad, String(p.hora_estimada).slice(0, 5)])) !== JSON.stringify(trip.paradas.map(([l, h], j) => [j + 1, l, h]))) {
        if (trip.paradas.length || stops.length) throw new Error(`Las paradas del viaje demo ${i + 1} ya existen y no coinciden`)
      }
    }

    stage = 'reservas'
    const solicitudIds = []
    for (const [i, item] of PASAJEROS.entries()) {
      const marker = `${TAG}-PAX-${String(i + 1).padStart(2, '0')}`
      let { rows } = await db.query('SELECT id, viaje_id, estado FROM solicitudes_viaje WHERE origen_descripcion=$1', [marker])
      if (rows.length > 1) throw new Error(`Marcador duplicado ${marker}`)
      if (!rows.length) {
        const trip = TRIPS[item.trip]
        const { rows: created } = await db.query(`INSERT INTO solicitudes_viaje(viaje_id,cliente_id,tipo,estado,origen_calle,origen_altura,origen_descripcion,origen_codigo_postal,destino_calle,destino_altura,destino_codigo_postal,nombre,apellido,dni,telefono,cantidad_pasajeros,forma_pago,origen_localidad,destino_localidad,distancia_km,precio_km,monto,resuelto_en,estado_pasajero,subio_en,llego_en) VALUES($1,$2,'pasajero',$3::varchar,'Av. Colón',$4,$5,'5000','Bv. San Juan',$6,'5000','Pasajero','Demo','99900001','3510000001',1,'transferencia',$7,$8,$9,$10,$11,CASE WHEN $16 THEN NOW() END,$12::varchar,CASE WHEN $17 THEN $13::date+$14::time END,CASE WHEN $17 THEN $13::date+$15::time END) RETURNING id`, [tripIds[item.trip], cliente.cliente_id, item.estado, String(100 + i), marker, String(200 + i), item.desde, item.hasta, Math.max(5, Math.round(TRIPS[item.trip].km / 2)), comisionista.precio_km, item.monto, item.operacion, trip.fecha, trip.salida, trip.llegada, item.estado !== 'pendiente', item.operacion === 'en_destino'])
        rows = created
      } else if (Number(rows[0].viaje_id) !== Number(tripIds[item.trip]) || rows[0].estado !== item.estado) throw new Error(`La reserva ${marker} existe con datos distintos`)
      solicitudIds.push(rows[0].id)
    }

    stage = 'solicitudes de encomienda'
    const solicitudPaqueteIds = []
    for (const [i, item] of PAQUETES.entries()) {
      const marker = `${TAG}-ENV-${String(i + 1).padStart(2, '0')}`
      let { rows } = await db.query('SELECT id, viaje_id, estado FROM solicitudes_viaje WHERE contenido_descripcion=$1', [marker])
      if (rows.length > 1) throw new Error(`Marcador duplicado ${marker}`)
      if (!rows.length) {
        const trip = TRIPS[item.trip]
        const { rows: created } = await db.query(`INSERT INTO solicitudes_viaje(viaje_id,cliente_id,tipo,estado,origen_calle,origen_altura,origen_codigo_postal,destino_calle,destino_altura,destino_codigo_postal,nombre,apellido,dni,telefono,forma_pago,peso_kg,ancho_cm,largo_cm,emisor_nombre,emisor_apellido,emisor_telefono,receptor_nombre,receptor_apellido,receptor_telefono,fragil,tipo_contenido,contenido_descripcion,origen_localidad,destino_localidad,distancia_km,precio_km,monto,resuelto_en,retirada_en,entregada_en) VALUES($1,$2,'encomienda',$3::varchar,'Av. Colón',$4,'5000','Bv. San Juan',$5,'5000','Cliente','Demo','99900002','3510000002','efectivo',2,30,25,'Cliente','Demo','3510000002','Destinatario','Demo','3510000003',false,'libros',$6,$7,$8,$9,$10,$11,CASE WHEN $16 THEN NOW() END,CASE WHEN $12 THEN $13::date+$14::time END,CASE WHEN $12 THEN $13::date+$15::time END) RETURNING id`, [tripIds[item.trip], cliente.cliente_id, item.estado, String(300 + i), String(400 + i), marker, item.desde, item.hasta, Math.max(5, Math.round(TRIPS[item.trip].km / 2)), comisionista.precio_km, item.estado === 'aceptada' ? 14000 + i * 500 : 0, item.retiro, trip.fecha, trip.salida, trip.llegada, item.estado !== 'pendiente'])
        rows = created
      } else if (Number(rows[0].viaje_id) !== Number(tripIds[item.trip]) || rows[0].estado !== item.estado) throw new Error(`La solicitud de encomienda ${marker} existe con datos distintos`)
      solicitudPaqueteIds.push(rows[0].id)
    }

    stage = 'encomiendas e historial'
    const estadosPaquete = ['pendiente', 'en_viaje', 'entregado', 'cancelada', 'en_viaje', 'pendiente']
    for (let i = 0; i < estadosPaquete.length; i += 1) {
      const marker = `${TAG}-PAQUETE-${String(i + 1).padStart(2, '0')}`
      const { rows: found } = await db.query('SELECT id, viaje_id, estado FROM encomiendas WHERE descripcion=$1', [marker])
      if (found.length > 1) throw new Error(`Marcador duplicado ${marker}`)
      if (found.length) {
        if (Number(found[0].viaje_id) !== Number(tripIds[i]) || found[0].estado !== estadosPaquete[i]) throw new Error(`La encomienda ${marker} existe con datos distintos`)
        continue
      }
      const trip = TRIPS[i]
      const { rows: [pack] } = await db.query(`INSERT INTO encomiendas(viaje_id,cliente_remitente_id,remitente_nombre,remitente_telefono,direccion_retiro,destinatario_nombre,destinatario_telefono,destinatario_direccion,tipo_contenido,peso_kg,dimensiones,tamano,fragil,descripcion,monto_flete,estado,estado_pago,fecha_solicitud) VALUES($1,$2,'Cliente Demo','3510000002','Av. Colón 100','Destinatario Demo','3510000003',$3,'libros',2,'0.5x0.5','pequeno',false,$4,12000,'pendiente','pendiente',$5::date) RETURNING id`, [tripIds[i], cliente.cliente_id, `Calle ${i + 1}, ${trip.destino}`, marker, trip.fecha])
      const estados = estadosPaquete[i] === 'en_viaje' ? ['aceptado', 'retirado', 'recibido', 'en_viaje'] : estadosPaquete[i] === 'entregado' ? ['aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'] : estadosPaquete[i] === 'cancelada' ? ['cancelada'] : []
      for (const estado of estados) await db.query(`UPDATE encomiendas SET estado=$2::varchar, estado_pago=CASE WHEN $3 THEN 'pagado' ELSE estado_pago END, retirado_en=CASE WHEN $4 THEN NOW() ELSE retirado_en END WHERE id=$1`, [pack.id, estado, estado === 'entregado', ['retirado', 'recibido', 'en_viaje', 'entregado'].includes(estado)])
    }

    stage = 'ingresos y gastos'
    const ingresosDemo = []
    for (const [i, item] of PASAJEROS.entries()) {
      if (item.operacion !== 'en_destino') continue
      const marker = `${TAG}-ING-PAX-${String(i + 1).padStart(2, '0')}`
      const { rows: previous } = await db.query('SELECT id FROM ingresos WHERE concepto=$1', [marker])
      if (!previous.length) {
        const { rows: [row] } = await db.query(`INSERT INTO ingresos(viaje_id,usuario_id,solicitud_id,tipo_servicio,concepto,monto,fecha,forma_pago,estado) VALUES($1,$2,$3,'pasajero',$4,$5,$6,'transferencia','activo') ON CONFLICT (solicitud_id) WHERE estado='activo' AND solicitud_id IS NOT NULL DO NOTHING RETURNING id`, [tripIds[item.trip], comisionista.id, solicitudIds[i], marker, item.monto, TRIPS[item.trip].fecha])
        if (row) ingresosDemo.push(row.id)
      }
    }
    for (const [i, item] of PAQUETES.entries()) {
      if (!item.retiro) continue
      const marker = `${TAG}-ING-ENV-${String(i + 1).padStart(2, '0')}`
      const { rows: previous } = await db.query('SELECT id FROM ingresos WHERE concepto=$1', [marker])
      if (!previous.length) {
        const { rows: [row] } = await db.query(`INSERT INTO ingresos(viaje_id,usuario_id,solicitud_id,tipo_servicio,concepto,monto,fecha,forma_pago,estado) VALUES($1,$2,$3,'encomienda',$4,$5,$6,'efectivo','activo') ON CONFLICT (solicitud_id) WHERE estado='activo' AND solicitud_id IS NOT NULL DO NOTHING RETURNING id`, [tripIds[item.trip], comisionista.id, solicitudPaqueteIds[i], marker, 14000 + i * 500, TRIPS[item.trip].fecha])
        if (row) ingresosDemo.push(row.id)
      }
    }
    const gastosIds = []
    for (const [i, trip] of TRIPS.entries()) {
      const marker = `${TAG}-GAS-${String(i + 1).padStart(2, '0')}`
      let { rows: types } = await db.query('SELECT id FROM tipos_gasto WHERE usuario_id=$1 AND lower(nombre)=lower($2)', [comisionista.id, `${TAG} combustible`])
      if (!types.length) types = (await db.query('INSERT INTO tipos_gasto(usuario_id,nombre,descripcion) VALUES($1,$2,$3) RETURNING id', [comisionista.id, `${TAG} combustible`, 'Tipo de gasto de datos de demostración'])).rows
      const { rows: existing } = await db.query('SELECT id FROM gastos WHERE descripcion=$1', [marker])
      if (!existing.length) {
        const amount = [9000, 12000, 21000, 7000, 5000, 3500][i]
        const { rows: [created] } = await db.query(`INSERT INTO gastos(viaje_id,usuario_id,tipo_gasto_id,categoria,monto,fecha,descripcion) VALUES($1,$2,$3,'combustible',$4,$5,$6) RETURNING id`, [i === 5 ? null : tripIds[i], comisionista.id, types[0].id, amount, trip.fecha, marker])
        gastosIds.push(created.id)
      }
    }
    const maintenanceName = `${TAG} mantenimiento`
    let { rows: maintenanceType } = await db.query('SELECT id FROM tipos_gasto WHERE usuario_id=$1 AND lower(nombre)=lower($2)', [comisionista.id, maintenanceName])
    if (!maintenanceType.length) maintenanceType = (await db.query('INSERT INTO tipos_gasto(usuario_id,nombre,descripcion) VALUES($1,$2,$3) RETURNING id', [comisionista.id, maintenanceName, 'Mantenimiento general de datos de demostración'])).rows
    const maintenanceMarker = `${TAG}-GAS-07`
    const { rows: existingMaintenance } = await db.query('SELECT id FROM gastos WHERE descripcion=$1', [maintenanceMarker])
    if (!existingMaintenance.length) {
      const { rows: [created] } = await db.query(`INSERT INTO gastos(viaje_id,usuario_id,tipo_gasto_id,categoria,monto,fecha,descripcion) VALUES(NULL,$1,$2,'mantenimiento',70000,'2026-10-29',$3) RETURNING id`, [comisionista.id, maintenanceType[0].id, maintenanceMarker])
      gastosIds.push(created.id)
    }

    stage = 'reportes históricos'
    const { rows: [profile] } = await db.query('SELECT nombre, apellido FROM usuarios WHERE id=$1', [comisionista.id])
    let reportesGenerados = 0
    for (const [desde, hasta, demoCode] of REPORTES) {
      const { rows: existing } = await db.query("SELECT id FROM reportes_rentabilidad WHERE usuario_id=$1 AND datos_snapshot->>'demo_code'=$2", [comisionista.id, demoCode])
      if (existing.length) continue
      const [incomeResult, expenseResult] = await Promise.all([
        db.query(`SELECT i.id, i.fecha::text AS fecha, i.monto::text AS monto, i.concepto, v.id AS viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS viaje_fecha FROM ingresos i LEFT JOIN viajes v ON v.id=i.viaje_id AND v.usuario_id=i.usuario_id WHERE i.usuario_id=$1 AND i.estado='activo' AND i.fecha BETWEEN $2::date AND $3::date ORDER BY i.fecha,i.id`, [comisionista.id, desde, hasta]),
        db.query(`SELECT g.id, g.fecha::text AS fecha, g.monto::text AS monto, t.nombre AS concepto, g.descripcion, v.id AS viaje_id, v.origen AS viaje_origen, v.destino AS viaje_destino, v.fecha::text AS viaje_fecha FROM gastos g JOIN tipos_gasto t ON t.id=g.tipo_gasto_id AND t.usuario_id=g.usuario_id LEFT JOIN viajes v ON v.id=g.viaje_id AND v.usuario_id=g.usuario_id WHERE g.usuario_id=$1 AND g.fecha BETWEEN $2::date AND $3::date ORDER BY g.fecha,g.id`, [comisionista.id, desde, hasta]),
      ])
      const generatedAt = new Date().toISOString()
      const snapshot = crearDatosSnapshotRentabilidad({ comisionista: `${profile.nombre} ${profile.apellido ?? ''}`.trim(), desde, hasta, generadoEn: generatedAt, ingresos: incomeResult.rows, gastos: expenseResult.rows })
      snapshot.demo = true
      snapshot.demo_code = demoCode
      await db.query(`INSERT INTO reportes_rentabilidad(usuario_id,periodo_desde,periodo_hasta,generado_en,total_ingresos,total_gastos,resultado_economico,version_snapshot,datos_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8::jsonb)`, [comisionista.id, desde, hasta, generatedAt, snapshot.total_ingresos, snapshot.total_gastos, snapshot.resultado_economico, JSON.stringify(snapshot)])
      reportesGenerados += 1
    }

    stage = 'verificación de identidad'
    let verificacionesCreadas = 0
    for (const [email, maskedDni] of [[CUENTAS.cliente.email, '••••9901'], [CUENTAS.comisionista.email, '••••9902']]) {
      const user = expected.get(email)
      const { rows: exists } = await db.query('SELECT id FROM verificaciones_identidad WHERE usuario_id=$1 AND dni_parcial=$2', [user.id, maskedDni])
      if (exists.length) continue
      const { rows: active } = await db.query("SELECT id FROM verificaciones_identidad WHERE usuario_id=$1 AND estado IN ('EN_PROCESO','PENDIENTE_REVISION')", [user.id])
      if (active.length) continue
      await db.query(`INSERT INTO verificaciones_identidad(usuario_id,estado,consentimiento_en,dni_parcial,resultado_ocr,coincidencias,controles_faciales,enviada_en) VALUES($1,'PENDIENTE_REVISION',NOW(),$2,'legible',$3::jsonb,$4::jsonb,NOW())`, [user.id, maskedDni, JSON.stringify({ nombre: true, apellido: true, dni: true }), JSON.stringify({ rostro_unico: true, parpadeo: true, giro: true, frente: true })])
      verificacionesCreadas += 1
    }

    stage = 'verificación final'
    const { rows: countsAfter } = await db.query(`SELECT (SELECT count(*)::int FROM viajes WHERE serie_id=ANY($1::uuid[])) AS viajes, (SELECT count(*)::int FROM paradas_viaje WHERE viaje_id=ANY($2::int[])) AS paradas, (SELECT count(*)::int FROM solicitudes_viaje WHERE cliente_id=$3 AND (origen_descripcion LIKE $4 OR contenido_descripcion LIKE $4)) AS solicitudes, (SELECT count(*)::int FROM encomiendas WHERE cliente_remitente_id=$5 AND descripcion LIKE $4) AS encomiendas, (SELECT count(*)::int FROM ingresos WHERE usuario_id=$6 AND concepto LIKE $4) AS ingresos, (SELECT count(*)::int FROM gastos WHERE usuario_id=$6 AND descripcion LIKE $4) AS gastos, (SELECT count(*)::int FROM reportes_rentabilidad WHERE usuario_id=$6 AND COALESCE(datos_snapshot->>'demo_code','') LIKE 'cuentas-%') AS reportes, (SELECT count(*)::int FROM verificaciones_identidad WHERE usuario_id=ANY($7::int[]) AND dni_parcial IN ('••••9901','••••9902')) AS verificaciones`, [TRIPS.map((t) => t.serie), tripIds, cliente.cliente_id, `${TAG}%`, cliente.cliente_id, comisionista.id, [cliente.id, comisionista.id]])
    const { rows: orphans } = await db.query(`SELECT (SELECT count(*) FROM solicitudes_viaje s LEFT JOIN viajes v ON v.id=s.viaje_id WHERE (s.origen_descripcion LIKE $1 OR s.contenido_descripcion LIKE $1) AND (v.id IS NULL OR s.cliente_id<>$2)) AS solicitudes, (SELECT count(*) FROM encomiendas e LEFT JOIN viajes v ON v.id=e.viaje_id WHERE e.descripcion LIKE $1 AND (v.id IS NULL OR e.cliente_remitente_id<>$3)) AS encomiendas, (SELECT count(*) FROM ingresos i LEFT JOIN viajes v ON v.id=i.viaje_id WHERE i.concepto LIKE $1 AND i.usuario_id<>$4) AS ingresos`, [`${TAG}%`, cliente.cliente_id, cliente.cliente_id, comisionista.id])
    if (Object.values(orphans[0]).some((value) => Number(value) !== 0)) throw new Error('Se detectaron relaciones huérfanas o con propietario incorrecto')
    await db.query('COMMIT')
    console.log(JSON.stringify({ target, accounts: users.map(({ email, rol }) => ({ email, rol })), createdOrAlreadyPresent: countsAfter[0], reportsGeneratedThisRun: reportesGenerados, verificationsCreatedThisRun: verificacionesCreadas, schemaTablesInspected: tableCount, databaseDeletes: 0, migrationsCreated: 0, verificationNote: 'Solo solicitudes pendientes; aprobación/rechazo requieren administrador fuera de estas dos cuentas.' }, null, 2))
  } catch (error) {
    await db.query('ROLLBACK')
    console.error(`Seed revertido en ${stage}; no quedaron cambios parciales: ${error.message}`)
    process.exitCode = 1
  } finally {
    db.release()
    await pool.end()
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
