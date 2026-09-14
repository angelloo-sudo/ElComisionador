import { Router } from 'express'
import * as viajes from '../controllers/viajes.controller.js'

const router = Router()

router.get('/', viajes.listar)        // US08
router.get('/:id', viajes.obtener)
router.post('/', viajes.crear)        // US06
router.put('/:id', viajes.actualizar) // US07
router.delete('/:id', viajes.eliminar)

export default router
