import { Router } from 'express'
import * as clientes from '../controllers/clientes.controller.js'
import { validarCliente } from '../validators/cliente.validador.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', autenticar, clientes.listar)                        // US08
router.get('/:id', autenticar, clientes.obtener)
router.post('/', autenticar, validarCliente, clientes.crear)        // US06
router.put('/:id', autenticar, validarCliente, clientes.actualizar) // US09
router.delete('/:id', autenticar, clientes.eliminar)

export default router