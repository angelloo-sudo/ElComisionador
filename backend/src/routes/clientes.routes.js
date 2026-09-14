import { Router } from 'express'
import * as clientes from '../controllers/clientes.controller.js'

const router = Router()

router.get('/', clientes.listar)        // US04
router.get('/:id', clientes.obtener)
router.post('/', clientes.crear)        // US03
router.put('/:id', clientes.actualizar) // US05
router.delete('/:id', clientes.eliminar)

export default router
