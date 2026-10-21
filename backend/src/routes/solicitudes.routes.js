import { Router } from 'express'
import * as solicitudes from '../controllers/solicitudes.controller.js'
import { actualizarEstadoPasajero } from '../controllers/pasajeros-viaje.controller.js'
import { paradasParaCliente } from '../controllers/paradas.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar)

// US19 - Cliente: ve los viajes, envia su solicitud (pasajero o encomienda) y la sigue.
router.get('/viajes-disponibles', permitirRoles('cliente'), solicitudes.listarViajesDisponibles)
router.get('/viajes-disponibles/:viajeId/tramo', permitirRoles('cliente'), solicitudes.tramoDeViaje)
router.get('/viajes-disponibles/:viajeId/paradas', permitirRoles('cliente'), paradasParaCliente)
router.get('/viajes-disponibles/:viajeId', permitirRoles('cliente'), solicitudes.obtenerViajeDisponible)
router.get('/mias', permitirRoles('cliente'), solicitudes.listarMias)
router.post('/', permitirRoles('cliente'), solicitudes.crear)
router.patch('/:id/cancelar', permitirRoles('cliente'), solicitudes.cancelar)

// US19 - Comisionista: solicitudes recibidas para sus viajes.
router.get('/recibidas', permitirRoles('comisionista'), solicitudes.listarRecibidas)
router.get('/:id/tramo', permitirRoles('comisionista'), solicitudes.tramoDeSolicitudRecibida)
router.patch('/:id/aceptar', permitirRoles('comisionista'), solicitudes.aceptar)
router.patch('/:id/retirar', permitirRoles('comisionista'), solicitudes.retirar)
router.patch('/:id/entregar', permitirRoles('comisionista'), solicitudes.entregar)
router.patch('/:id/pasajero', permitirRoles('comisionista'), actualizarEstadoPasajero) // US22/24/25
router.patch('/:id/rechazar', permitirRoles('comisionista'), solicitudes.rechazar)

export default router
