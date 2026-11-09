import { Router } from 'express'
import * as verificaciones from '../controllers/verificaciones.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar)

router.get('/mias', permitirRoles('cliente', 'comisionista'), verificaciones.listarMias)
router.post('/', permitirRoles('cliente', 'comisionista'), verificaciones.iniciar)
router.patch('/:id/enviar', permitirRoles('cliente', 'comisionista'), verificaciones.enviar)
router.get('/admin', permitirRoles('administrador'), verificaciones.listarAdministrativas)
router.get('/admin/:id', permitirRoles('administrador'), verificaciones.detalleAdministrativo)
router.patch('/admin/:id/resolver', permitirRoles('administrador'), verificaciones.resolver)

export default router
