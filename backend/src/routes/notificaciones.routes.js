import { Router } from 'express'
import * as notificaciones from '../controllers/notificaciones.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar, permitirRoles('cliente'))
router.get('/', notificaciones.listar)
router.patch('/:id/leida', notificaciones.marcarLeida)
export default router
