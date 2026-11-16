import { Router } from 'express'
import * as admin from '../controllers/admin.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar, permitirRoles('administrador'))

router.get('/resumen', admin.resumen)
router.get('/usuarios', admin.listarUsuarios)
router.get('/actividad', admin.actividad)

export default router
