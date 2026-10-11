// Conexion a PostgreSQL mediante un pool reutilizable.
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    }

if (process.env.DB_SSL === 'true') {
  connectionConfig.ssl = { rejectUnauthorized: false }
}

export const pool = new Pool(connectionConfig)

// Helper para hacer consultas: query('SELECT ...', [params])
export const query = (text, params) => pool.query(text, params)
