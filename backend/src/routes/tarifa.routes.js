import { Router } from 'express'
import * as tarifa from '../controllers/tarifa.controller.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(autenticar, permitirRoles('comisionista'))

router.get('/', tarifa.obtener)  // precio por km actual
router.put('/', tarifa.guardar)  // configurar / cambiar el precio por km

export default router
