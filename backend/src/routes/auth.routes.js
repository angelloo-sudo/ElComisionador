import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'

const router = Router()

router.post('/register', auth.register) // US01
router.post('/login', auth.login)       // US02

export default router
