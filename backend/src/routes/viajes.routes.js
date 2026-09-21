import { Router } from 'express'
import * as viajes from '../controllers/viajes.controller.js'
import { validarViaje } from '../validators/viaje.validador.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', autenticar, viajes.listar)                // US12
router.get('/:id', autenticar, viajes.obtener)             // US12
router.post('/', autenticar, validarViaje, viajes.crear)   // US10
router.put('/:id', autenticar, viajes.actualizar)          // US11 (pendiente)
router.delete('/:id', autenticar, viajes.eliminar)         // US11 (pendiente)

export default router
