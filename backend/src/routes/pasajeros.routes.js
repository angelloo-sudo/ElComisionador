import { Router } from 'express'
import * as pasajeros from '../controllers/pasajeros.controller.js'

const router = Router()

// US19 (el cliente solicita un viaje y el comisionista acepta o rechaza): ver /api/solicitudes.
router.get('/', pasajeros.listar)   // US14
router.post('/', pasajeros.crear)   // US14
router.post('/asignar', pasajeros.asignarAViaje) // US15
router.get('/viaje/:viajeId/cupos', pasajeros.cupos) // US16

export default router
