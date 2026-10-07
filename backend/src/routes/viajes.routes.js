import { Router } from 'express'
import * as viajes from '../controllers/viajes.controller.js'
import { validarViaje } from '../validators/viaje.validador.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

// Épica 4: Gestión de Viajes y Traslados. Los viajes los administra el comisionista.
router.use(autenticar, permitirRoles('comisionista'))

router.get('/', viajes.listar)                // Consultar / filtrar viajes
router.get('/:id', viajes.obtener)            // Consultar un viaje
router.post('/', validarViaje, viajes.crear)  // Registrar viaje
router.patch('/:id/cancelar', viajes.cancelar) // US16: registrar cancelacion de viaje
router.put('/:id', validarViaje, viajes.actualizar) // US18: modificar definicion de viaje
router.delete('/:id', viajes.eliminar)        // fuera de alcance del Sprint 1 (sin US asignada)

export default router
