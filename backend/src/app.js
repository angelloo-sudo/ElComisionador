// Configuracion de la app Express: middlewares y rutas.
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import router from './routes/index.js'
import { errorHandler } from './middlewares/errorHandler.js'

export const app = express()

app.use(cors())            // permite peticiones desde el frontend
app.use(express.json({ limit: '1mb' })) // parsea body JSON (1 MB: la foto de perfil viaja como base64)
app.use(morgan('dev'))     // loguea cada request en consola

// Chequeo rapido de que la API esta viva
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'comitrack-api' })
})

// Todas las rutas del negocio cuelgan de /api
app.use('/api', router)

const frontendDistPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist')
const frontendIndexPath = resolve(frontendDistPath, 'index.html')

if (existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(frontendIndexPath)
  })
}

// Manejo central de errores (siempre al final)
app.use(errorHandler)
