import { Router } from 'express'
import * as solicitudes from '../controllers/solicitudes.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar)

// US19 - Cliente: ve los viajes, envia su solicitud (pasajero o encomienda) y la sigue.
router.get('/viajes-disponibles', permitirRoles('cliente'), solicitudes.listarViajesDisponibles)
router.get('/viajes-disponibles/:viajeId', permitirRoles('cliente'), solicitudes.obtenerViajeDisponible)
router.get('/mias', permitirRoles('cliente'), solicitudes.listarMias)
router.post('/', permitirRoles('cliente'), solicitudes.crear)
router.patch('/:id/cancelar', permitirRoles('cliente'), solicitudes.cancelar)

// US19 - Comisionista: solicitudes recibidas para sus viajes.
router.get('/recibidas', permitirRoles('comisionista'), solicitudes.listarRecibidas)
router.patch('/:id/aceptar', permitirRoles('comisionista'), solicitudes.aceptar)
router.patch('/:id/rechazar', permitirRoles('comisionista'), solicitudes.rechazar)

export default router
