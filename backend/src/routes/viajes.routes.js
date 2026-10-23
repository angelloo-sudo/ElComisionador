import { Router } from 'express'
import * as viajes from '../controllers/viajes.controller.js'
import { listarPasajeros } from '../controllers/pasajeros-viaje.controller.js'
import { paradasDelComisionista } from '../controllers/paradas.controller.js'
import { validarViaje } from '../validators/viaje.validador.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

// Épica 4: Gestión de Viajes y Traslados. Los viajes los administra el comisionista.
router.use(autenticar, permitirRoles('comisionista'))

router.get('/', viajes.listar)                // Consultar / filtrar viajes
router.get('/:id/paradas', paradasDelComisionista) // paradas de los pasajeros aceptados + ruta sugerida
router.get('/:id/recordatorio', viajes.obtenerRecordatorio) // US26
router.put('/:id/recordatorio', viajes.guardarRecordatorio) // US26
router.delete('/:id/recordatorio', viajes.eliminarRecordatorio) // US26 (opt-out)
router.get('/:id/pasajeros', listarPasajeros) // US22/24/25: pasajeros aceptados y su estado
router.get('/:id', viajes.obtener)            // Consultar un viaje
router.post('/', validarViaje, viajes.crear)  // Registrar viaje
router.patch('/:id/cancelar', viajes.cancelar) // US16: registrar cancelacion de viaje
router.patch('/:id/iniciar', viajes.iniciar)     // US20: iniciar viaje (programado -> en curso)
router.patch('/:id/finalizar', viajes.finalizar) // US21: finalizar viaje (en curso -> finalizado)
router.put('/:id', validarViaje, viajes.actualizar) // US18: modificar definicion de viaje
router.delete('/:id', viajes.eliminar)        // fuera de alcance del Sprint 1 (sin US asignada)

export default router
