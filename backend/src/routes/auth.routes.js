import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()

// Épica 1: Autenticación y Seguridad.
router.post('/login', auth.login)     // US01
// US02 (cerrar sesión) es client-side: se descarta el token guardado, no hay endpoint.

// Épica 2: Gestión de Usuarios (Comisionista) - autogestión de la propia cuenta.
router.post('/register-comisionista', auth.registerComisionista) // US06 (autorregistro, siempre rol 'comisionista')

// Épica 3: Gestión de Usuarios (Cliente) - autogestión de la propia cuenta.
router.post('/register', auth.register)                       // US11 (autorregistro, siempre rol 'cliente')

// Estas tres rutas son genéricas para CUALQUIER usuario autenticado (comisionista,
// cliente o administrador) y cubren a la vez:
//   - Comisionista: US09 (modificar mi usuario) / US10 (consultar mi información)
//   - Cliente:      US13 (consultar mi usuario) / US14 (modificar mi usuario)
router.get('/perfil', autenticar, auth.obtenerMiPerfil)        // US10 / US13
router.put('/perfil', autenticar, auth.actualizarMiPerfil)     // US09 / US14
router.delete('/perfil', autenticar, auth.darDeBajaMiCuenta)   // US07 / US12 (baja = borrado real)

router.post('/recuperar', auth.solicitarRecuperacion)
router.post('/restablecer', auth.restablecerPassword)

export default router
