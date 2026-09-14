// Configuracion de la app Express: middlewares y rutas.
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import router from './routes/index.js'
import { errorHandler } from './middlewares/errorHandler.js'

export const app = express()

app.use(cors())            // permite peticiones desde el frontend
app.use(express.json())    // parsea body JSON
app.use(morgan('dev'))     // loguea cada request en consola

// Chequeo rapido de que la API esta viva
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'comitrack-api' })
})

// Todas las rutas del negocio cuelgan de /api
app.use('/api', router)

// Manejo central de errores (siempre al final)
app.use(errorHandler)
