// Conexion a PostgreSQL mediante un pool reutilizable.
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

// Helper para hacer consultas: query('SELECT ...', [params])
export const query = (text, params) => pool.query(text, params)
