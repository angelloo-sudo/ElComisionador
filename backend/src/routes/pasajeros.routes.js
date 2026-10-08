import { Router } from 'express'
import * as pasajeros from '../controllers/pasajeros.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/mis-traslados', autenticar, permitirRoles('cliente'), pasajeros.listarMisTraslados)
router.patch(
  '/mis-traslados/:viajeId/:pasajeroId/cancelar',
  autenticar,
  permitirRoles('cliente'),
  pasajeros.cancelarMiTraslado,
)

router.get('/', pasajeros.listar)   // US14
router.post('/', pasajeros.crear)   // US14
router.post('/asignar', pasajeros.asignarAViaje) // US15
router.get('/viaje/:viajeId/cupos', pasajeros.cupos) // US16

export default router
