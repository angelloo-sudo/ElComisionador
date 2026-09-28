import { Router } from 'express'
import * as viajes from '../controllers/viajes.controller.js'
import { validarViaje } from '../validators/viaje.validador.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

// Épica 4: Gestión de Viajes y Traslados. Los viajes los administra el comisionista.
router.use(autenticar, permitirRoles('comisionista'))

router.get('/', viajes.listar)                // US16
router.get('/:id', viajes.obtener)            // US16
router.post('/', validarViaje, viajes.crear)  // US14
router.put('/:id', viajes.actualizar)         // fuera de alcance del Sprint 1 (sin US asignada)
router.delete('/:id', viajes.eliminar)        // fuera de alcance del Sprint 1 (sin US asignada)

export default router
