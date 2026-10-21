// Carga datos de demostracion para recorrer ComiTrack.
// Ejecutar desde la raiz: npm --prefix backend run seed:demo
import bcrypt from 'bcryptjs'
import { pool } from '../src/config/db.js'

const clientes = [
  ['Ana', 'Pereyra'], ['Bruno', 'Sosa'], ['Camila', 'Luna'], ['Diego', 'Rojas'],
  ['Elena', 'Molina'], ['Franco', 'Quiroga'], ['Gisela', 'Castro'], ['Hugo', 'Ferreyra'],
  ['Ines', 'Romero'], ['Joaquin', 'Herrera'], ['Karen', 'Medina'], ['Lucas', 'Suarez'],
  ['Malena', 'Arias'], ['Nicolas', 'Campos'], ['Olivia', 'Navarro'], ['Pablo', 'Acosta'],
  ['Rocio', 'Vega'], ['Santiago', 'Paz'], ['Tamara', 'Benitez'], ['Ulises', 'Correa'],
]

const comisionistas = [
  ['Martin', 'Gomez'], ['Natalia', 'Fernandez'], ['Oscar', 'Alvarez'], ['Paula', 'Torres'],
  ['Ramiro', 'Silva'], ['Sofia', 'Cabrera'], ['Tomas', 'Mendez'], ['Valentina', 'Ruiz'],
  ['Walter', 'Morales'], ['Zoe', 'Ibarra'],
]

const rutas = [
  ['Cordoba Capital', 'Villa Carlos Paz'], ['Villa Carlos Paz', 'Cordoba Capital'],
  ['Cordoba Capital', 'Alta Gracia'], ['Alta Gracia', 'Cordoba Capital'],
  ['Cordoba Capital', 'Rio Ceballos'], ['Rio Ceballos', 'Cordoba Capital'],
  ['Cordoba Capital', 'Jesus Maria'], ['Jesus Maria', 'Cordoba Capital'],
  ['Cordoba Capital', 'Villa Allende'], ['Villa Allende', 'Cordoba Capital'],
]

const nombresContenido = ['ropa', 'libros', 'alimentos', 'documentacion', 'juguetes', 'hogar', 'electronica', 'otro']
const estados = ['pendiente', 'aceptada', 'rechazada', 'cancelada']
const calles = ['San Martin', 'Belgrano', 'Rivadavia', 'Sarmiento', 'Independencia']

async function main() {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    // Las cuentas demo tienen correos propios; al repetir la carga solo se reemplaza ese conjunto.
    await db.query("DELETE FROM usuarios WHERE email LIKE 'demo.cliente.%@comitrack.test' OR email LIKE 'demo.comisionista.%@comitrack.test'")
    const hash = await bcrypt.hash('Demo1234!', 10)
    const clienteIds = []
    const comisionistaIds = []

    for (let i = 0; i < clientes.length; i++) {
      const [nombre, apellido] = clientes[i]
      const { rows } = await db.query(
        `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, activo, email_verificado)
         VALUES ($1, $2, $3, $4, 'cliente', true, true) RETURNING id`,
        [nombre, apellido, `demo.cliente.${String(i + 1).padStart(2, '0')}@comitrack.test`, hash],
      )
      const { rows: perfil } = await db.query(
        'INSERT INTO clientes (usuario_id, dni, telefono) VALUES ($1, $2, $3) RETURNING id',
        [rows[0].id, String(31000000 + i), `351${String(5000000 + i)}`],
      )
      clienteIds.push(perfil[0].id)
    }

    for (let i = 0; i < comisionistas.length; i++) {
      const [nombre, apellido] = comisionistas[i]
      const { rows } = await db.query(
        `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, activo, email_verificado)
         VALUES ($1, $2, $3, $4, 'comisionista', true, true) RETURNING id`,
        [nombre, apellido, `demo.comisionista.${String(i + 1).padStart(2, '0')}@comitrack.test`, hash],
      )
      const { rows: perfil } = await db.query(
        'INSERT INTO comisionistas (usuario_id, dni, telefono, presentacion) VALUES ($1, $2, $3, $4) RETURNING id',
        [rows[0].id, String(28000000 + i), `351${String(4000000 + i)}`, `Comisionista de demostracion ${i + 1}. Viajes seguros por Cordoba.`],
      )
      comisionistaIds.push({ usuario: rows[0].id, perfil: perfil[0].id })
    }

    const viajeIds = []
    for (let i = 0; i < rutas.length; i++) {
      const day = i + 1
      const date = new Date()
      date.setDate(date.getDate() + day)
      const fecha = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const [origen, destino] = rutas[i]
      const { rows } = await db.query(
        `INSERT INTO viajes (usuario_id, origen, destino, fecha, hora_salida, hora_llegada, cupo_total, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 4, 'programado') RETURNING id`,
        [comisionistaIds[i].usuario, origen, destino, fecha, `${8 + (i % 5)}:00`, `${9 + (i % 5)}:15`],
      )
      viajeIds.push(rows[0].id)
    }

    for (let i = 0; i < 20; i++) {
      const tipo = i % 2 === 0 ? 'pasajero' : 'encomienda'
      const estado = estados[Math.floor(i / 2) % estados.length]
      const common = [
        viajeIds[i % viajeIds.length], clienteIds[i], tipo, estado,
        calles[i % calles.length], String(100 + i), 'Centro',
        calles[(i + 2) % calles.length], String(500 + i), 'Nueva Cordoba',
      ]
      const cols = ['viaje_id', 'cliente_id', 'tipo', 'estado', 'origen_calle', 'origen_altura', 'origen_barrio', 'destino_calle', 'destino_altura', 'destino_barrio']
      const vals = [...common]
      if (tipo === 'pasajero') {
        cols.push('nombre', 'apellido', 'dni', 'telefono', 'lleva_equipaje', 'equipaje_detalle', 'cantidad_pasajeros', 'forma_pago')
        vals.push(clientes[i][0], clientes[i][1], String(31000000 + i), `351${String(5000000 + i)}`, i % 3 === 0, i % 3 === 0 ? 'Mochila chica' : null, 1, i % 2 ? 'transferencia' : 'efectivo')
      } else {
        cols.push('peso_kg', 'ancho_cm', 'largo_cm', 'fragil', 'tipo_contenido', 'contenido_descripcion', 'forma_pago', 'emisor_nombre', 'emisor_apellido', 'emisor_telefono', 'receptor_nombre', 'receptor_apellido', 'receptor_telefono')
        vals.push(1.5 + (i % 4), 20, 30, i % 3 === 1, nombresContenido[Math.floor(i / 2) % nombresContenido.length], 'Paquete de demostracion', i % 2 ? 'transferencia' : 'efectivo', clientes[i][0], clientes[i][1], `351${String(5000000 + i)}`, 'Destinatario', 'Demo', '3514555666')
      }
      if (estado === 'rechazada') {
        cols.push('motivo_rechazo')
        vals.push('No hay disponibilidad para ese horario (dato de demostracion).')
      }
      const marks = vals.map((_, index) => `$${index + 1}`).join(', ')
      await db.query(`INSERT INTO solicitudes_viaje (${cols.join(', ')}) VALUES (${marks})`, vals)
    }

    // Algunas solicitudes aceptadas generan movimiento financiero visible en el panel.
    for (let i = 0; i < comisionistaIds.length; i++) {
      const viajeId = viajeIds[i]
      await db.query('INSERT INTO ingresos (viaje_id, concepto, monto, fecha) VALUES ($1, $2, $3, CURRENT_DATE)', [viajeId, 'Pasaje de demostracion', 8000 + i * 500])
      await db.query('INSERT INTO gastos (viaje_id, categoria, monto, fecha) VALUES ($1, $2, $3, CURRENT_DATE)', [viajeId, i % 2 ? 'peaje' : 'combustible', 1500 + i * 100])
    }

    await db.query('COMMIT')
    console.log('Datos demo cargados: 20 clientes, 10 comisionistas, 10 viajes, 20 solicitudes (todos los estados) y movimientos financieros.')
    console.log('Clave comun: Demo1234! | Cuentas: demo.cliente.01@comitrack.test y demo.comisionista.01@comitrack.test')
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('No se pudieron cargar los datos demo:', error.message)
  process.exitCode = 1
})
