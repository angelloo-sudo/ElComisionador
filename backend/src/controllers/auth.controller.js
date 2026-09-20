import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/db.js'

const JWT_SECRET = process.env.JWT_SECRET

function crearToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '8h' })
}

export async function register(req, res, next) {
  try {
    const { nombre, email, password } = req.body

    if (!nombre?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ mensaje: 'Nombre, email y una contraseña de al menos 6 caracteres son obligatorios' })
    }

    const emailNormalizado = email.trim().toLowerCase()
    const existente = await query('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado])
    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'El email ya está registrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, email, creado_en`,
      [nombre.trim(), emailNormalizado, passwordHash]
    )

    const usuario = rows[0]
    res.status(201).json({ usuario, token: crearToken(usuario) })
  } catch (e) { next(e) }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    const resultado = await query('SELECT * FROM usuarios WHERE email = $1', [email?.trim().toLowerCase()])
    const usuario = resultado.rows[0]

    if (!usuario || !password || !(await bcrypt.compare(password, usuario.password_hash))) {
      return res.status(401).json({ mensaje: 'Email o contraseña incorrectos' })
    }

    const datosPublicos = { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
    res.json({ usuario: datosPublicos, token: crearToken(datosPublicos) })
  } catch (e) { next(e) }
}
