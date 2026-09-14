import { Router } from 'express'
import * as pasajeros from '../controllers/pasajeros.controller.js'

const router = Router()

router.get('/', pasajeros.listar)   // US14
router.post('/', pasajeros.crear)   // US14
router.post('/asignar', pasajeros.asignarAViaje) // US15
router.get('/viaje/:viajeId/cupos', pasajeros.cupos) // US16

export default router
