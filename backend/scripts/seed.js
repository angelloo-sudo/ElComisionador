import bcrypt from 'bcryptjs'
import { pool } from '../src/config/db.js'

const PASSWORD = '41022834'
const PASSWORD_ROUNDS = 10

const accounts = [
  {
    nombre: 'Cliente',
    apellido: 'Prueba',
    email: 'cl@gmail.com',
    rol: 'cliente',
    dni: '99999999',
    telefono: '1111111111',
    profileTable: 'clientes',
  },
  {
    nombre: 'Comisionista',
    apellido: 'Prueba',
    email: 'comi@gmail.com',
    rol: 'comisionista',
    dni: '99999998',
    telefono: '1111111112',
    profileTable: 'comisionistas',
  },
]

async function seedAccount(client, account) {
  const passwordHash = await bcrypt.hash(PASSWORD, PASSWORD_ROUNDS)
  const { rows } = await client.query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, email_verificado)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, rol`,
    [account.nombre, account.apellido, account.email, passwordHash, account.rol],
  )
  const usuario = rows[0] ?? (await client.query(
    'SELECT id, rol FROM usuarios WHERE email = $1',
    [account.email],
  )).rows[0]

  if (!usuario || usuario.rol !== account.rol) {
    throw new Error(`La cuenta ${account.email} ya existe con un rol distinto de "${account.rol}"`)
  }

  await client.query(
    `INSERT INTO ${account.profileTable} (usuario_id, dni, telefono)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id) DO NOTHING`,
    [usuario.id, account.dni, account.telefono],
  )
}

const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const account of accounts) {
    await seedAccount(client, account)
  }
  await client.query('COMMIT')
  console.log('Seed aplicado: cl@gmail.com (cliente) y comi@gmail.com (comisionista)')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
