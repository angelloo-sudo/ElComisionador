import { Router } from 'express'
import * as localidades from '../controllers/localidades.controller.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', autenticar, localidades.listar)

export default router
