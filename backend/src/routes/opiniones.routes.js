import { Router } from 'express'
import * as opiniones from '../controllers/opiniones.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', opiniones.listar) // público: se muestra en la portada
router.post('/', autenticar, permitirRoles('cliente', 'comisionista'), opiniones.crear)

export default router
