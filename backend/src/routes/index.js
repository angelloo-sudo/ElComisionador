import { Router } from 'express'
import authRoutes from './auth.routes.js'
import viajesRoutes from './viajes.routes.js'
import encomiendasRoutes from './encomiendas.routes.js'
import pasajerosRoutes from './pasajeros.routes.js'
import finanzasRoutes from './finanzas.routes.js'
import localidadesRoutes from './localidades.routes.js'
import clientesRoutes from './clientes.routes.js'
import solicitudesRoutes from './solicitudes.routes.js'
import geoRoutes from './geo.routes.js'
import tarifaRoutes from './tarifa.routes.js'
import resumenRoutes from './resumen.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/viajes', viajesRoutes)
router.use('/encomiendas', encomiendasRoutes)
router.use('/pasajeros', pasajerosRoutes)
router.use('/finanzas', finanzasRoutes)
router.use('/localidades', localidadesRoutes)
router.use('/clientes', clientesRoutes)
router.use('/solicitudes', solicitudesRoutes)
router.use('/geo', geoRoutes)
router.use('/tarifa', tarifaRoutes)
router.use('/resumen', resumenRoutes)

export default router
