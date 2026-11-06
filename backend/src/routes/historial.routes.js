import { Router } from 'express'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'
import * as historial from '../controllers/historial.controller.js'

const router = Router()
router.use(autenticar, permitirRoles('comisionista'))

router.get('/viajes', historial.listarViajes)
router.get('/viajes/:id', historial.obtenerViaje)
router.get('/clientes', historial.listarClientes)
router.get('/clientes/:clienteId/operaciones', historial.listarOperacionesCliente)
router.get('/encomiendas', historial.listarEncomiendas)
router.get('/encomiendas/:origenRegistro/:id', historial.obtenerEncomienda)
router.get('/encomiendas/:id', historial.obtenerEncomienda)
router.get('/pasajeros', historial.listarPasajeros)
router.get('/pasajeros/:solicitudId', historial.obtenerPasajero)

export default router
