import { Router } from 'express'
import * as finanzas from '../controllers/finanzas.controller.js'
import * as gastos from '../controllers/gastos.controller.js'
import * as ingresos from '../controllers/ingresos.controller.js'
import * as tiposGasto from '../controllers/tipos-gasto.controller.js'
import { validarGasto, validarTipoGasto } from '../validators/gasto.validador.js'
import { autenticar, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

// Los gastos y sus tipos los administra el comisionista y son privados de cada uno.
const soloComisionista = [autenticar, permitirRoles('comisionista')]

// Epica 6 - Ingresos. El cobro (US35) lo registra el sistema solo al llegar el pasajero a destino
// o al retirarse la encomienda; aca se consulta (US37), modifica (US38) y anula (US39).
router.get('/ingresos', soloComisionista, ingresos.listar)
router.get('/ingresos/:id', soloComisionista, ingresos.obtener)                              // US37
router.put('/ingresos/:id', soloComisionista, ingresos.modificar)                            // US38
router.patch('/ingresos/:id/anular', soloComisionista, ingresos.anular)                      // US39
router.get('/viaje/:viajeId/ganancia', finanzas.gananciaViaje) // Epica 8 (pendiente)
router.get('/rentabilidad', finanzas.rentabilidad)  // Epica 8 (pendiente)

// Epica 7 - Tipos de gasto (se declaran antes que /gastos/:id para no mezclar rutas).
router.get('/tipos-gasto', soloComisionista, tiposGasto.listar)                              // US47
router.post('/tipos-gasto', soloComisionista, validarTipoGasto, tiposGasto.crear)            // US45
router.get('/tipos-gasto/:id', soloComisionista, tiposGasto.obtener)                         // US47
router.put('/tipos-gasto/:id', soloComisionista, validarTipoGasto, tiposGasto.actualizar)    // US46
router.delete('/tipos-gasto/:id', soloComisionista, tiposGasto.eliminar)                     // US48

// Epica 7 - Gastos
router.get('/gastos', soloComisionista, gastos.listar)                                       // US43
router.post('/gastos', soloComisionista, validarGasto, gastos.crear)                         // US40
router.get('/gastos/:id', soloComisionista, gastos.obtener)                                  // US43
router.put('/gastos/:id', soloComisionista, validarGasto, gastos.actualizar)                 // US41
router.patch('/gastos/:id/tipo', soloComisionista, gastos.asignarTipo)                       // US44
router.delete('/gastos/:id', soloComisionista, gastos.eliminar)                              // US42

export default router
