import { Router } from 'express'
import { listar } from '../controllers/clientes.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', autenticar, permitirRoles('comisionista'), listar)

export default router