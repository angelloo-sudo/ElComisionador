import { Router } from 'express'
import * as resumen from '../controllers/resumen.controller.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()
// Pantalla de inicio: cada usuario ve el resumen de su rol.
router.get('/', autenticar, resumen.resumen)

export default router
