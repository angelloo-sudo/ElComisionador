import { Router } from 'express'
import { listar, obtener } from '../controllers/clientes.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', autenticar, permitirRoles('comisionista'), listar)
router.get('/:id', autenticar, permitirRoles('comisionista'), obtener)

export default router