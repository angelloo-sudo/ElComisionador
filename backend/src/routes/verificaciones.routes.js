import { Router } from 'express'
import * as verificaciones from '../controllers/verificaciones.controller.js'
import { autenticar, autenticarVerificacion, permitirRoles } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/registro/perfil', autenticarVerificacion, verificaciones.perfilRegistro)
router.get('/registro/estado', autenticarVerificacion, verificaciones.estadoRegistro)
router.get('/mias', autenticar, permitirRoles('cliente', 'comisionista'), verificaciones.listarMias)
router.post('/', autenticarVerificacion, verificaciones.iniciar)
router.patch('/:id/documento', autenticarVerificacion, verificaciones.validarDocumentoRegistro)
router.patch('/:id/enviar', autenticarVerificacion, verificaciones.enviar)
router.get('/admin', autenticar, permitirRoles('administrador'), verificaciones.listarAdministrativas)
router.get('/admin/:id', autenticar, permitirRoles('administrador'), verificaciones.detalleAdministrativo)
router.patch('/admin/:id/resolver', autenticar, permitirRoles('administrador'), verificaciones.resolver)

export default router
