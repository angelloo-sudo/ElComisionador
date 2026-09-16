import { Router } from 'express'
import * as clientes from '../controllers/clientes.controller.js'
import { validarCliente } from '../validators/cliente.validator.js'

const router = Router()

router.get('/', clientes.listar)                        // US08
router.get('/:id', clientes.obtener)
router.post('/', validarCliente, clientes.crear)        // US06
router.put('/:id', validarCliente, clientes.actualizar) // US09
router.delete('/:id', clientes.eliminar)

export default router