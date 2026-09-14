import { Router } from 'express'
import authRoutes from './auth.routes.js'
import clientesRoutes from './clientes.routes.js'
import viajesRoutes from './viajes.routes.js'
import encomiendasRoutes from './encomiendas.routes.js'
import pasajerosRoutes from './pasajeros.routes.js'
import finanzasRoutes from './finanzas.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/clientes', clientesRoutes)
router.use('/viajes', viajesRoutes)
router.use('/encomiendas', encomiendasRoutes)
router.use('/pasajeros', pasajerosRoutes)
router.use('/finanzas', finanzasRoutes)

export default router
