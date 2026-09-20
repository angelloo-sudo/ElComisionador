import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'

const router = Router()

router.get('/perfil/:id', auth.obtenerPerfil) // US03
router.post('/register', auth.register) // US01
router.post('/login', auth.login)       // US02

export default router
