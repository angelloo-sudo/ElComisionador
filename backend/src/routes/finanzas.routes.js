import { Router } from 'express'
import * as finanzas from '../controllers/finanzas.controller.js'

const router = Router()

router.post('/ingresos', finanzas.registrarIngreso) // US17
router.post('/gastos', finanzas.registrarGasto)     // US18
router.get('/viaje/:viajeId/ganancia', finanzas.gananciaViaje) // US19
router.get('/rentabilidad', finanzas.rentabilidad)  // US20

export default router
