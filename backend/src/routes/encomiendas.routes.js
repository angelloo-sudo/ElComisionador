import { Router } from 'express'
import * as encomiendas from '../controllers/encomiendas.controller.js'

const router = Router()

router.get('/', encomiendas.listar)               // US12
router.get('/:id', encomiendas.obtener)
router.post('/', encomiendas.crear)               // US10 / US11
router.put('/:id', encomiendas.actualizar)
router.patch('/:id/estado', encomiendas.cambiarEstado) // US13
router.delete('/:id', encomiendas.eliminar)

export default router
