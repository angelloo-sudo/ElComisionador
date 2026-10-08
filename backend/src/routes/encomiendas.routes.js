import { Router } from 'express'
import * as encomiendas from '../controllers/encomiendas.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', encomiendas.listar)               // US12
router.get('/mis-solicitudes', autenticar, permitirRoles('cliente'), encomiendas.listarMisSolicitudes)
router.get('/pendientes', autenticar, permitirRoles('comisionista', 'administrador'), encomiendas.listarPendientes)
router.get('/aceptadas', autenticar, permitirRoles('comisionista', 'administrador'), encomiendas.listarAceptadas)
router.patch('/:id/aceptar', autenticar, permitirRoles('comisionista', 'administrador'), encomiendas.aceptar)
router.get('/:id', encomiendas.obtener)
router.post('/', autenticar, permitirRoles('cliente'), encomiendas.crear) // CU27
router.put('/:id', autenticar, permitirRoles('cliente'), encomiendas.actualizar)
router.patch('/:id/estado', autenticar, permitirRoles('comisionista', 'administrador'), encomiendas.cambiarEstado) // US13
router.delete('/:id', autenticar, permitirRoles('cliente'), encomiendas.eliminar)

export default router
