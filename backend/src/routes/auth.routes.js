import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'
import { autenticar } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/perfil/:id', auth.obtenerPerfil) // US03
router.get('/perfil', autenticar, auth.obtenerMiPerfil) // US04
router.put('/perfil', autenticar, auth.actualizarMiPerfil) // US04
router.post('/register', auth.register) // US01
router.post('/login', auth.login)       // US02

export default router
