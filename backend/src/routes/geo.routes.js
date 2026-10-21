import { Router } from 'express'
import * as geo from '../controllers/geo.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar)

// Ruta del viaje en el mapa: la ven el comisionista y el cliente.
router.get('/ruta', permitirRoles('cliente', 'comisionista'), geo.ruta)
// Verificacion de calle + altura al cargar una solicitud (cliente).
router.post('/validar-direccion', permitirRoles('cliente'), geo.validar)

export default router
