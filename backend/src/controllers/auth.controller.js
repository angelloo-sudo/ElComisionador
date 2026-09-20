import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/db.js'

const JWT_SECRET = process.env.JWT_SECRET

function crearToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '8h' })
}

function validarDatosPerfil({ nombre, email, password }) {
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 120) {
    return 'El nombre es obligatorio y debe tener entre 1 y 120 caracteres'
  }

  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!emailNormalizado || emailNormalizado.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
    return 'Ingresá un email válido de hasta 120 caracteres'
  }

  if (password !== undefined && typeof password !== 'string') {
    return 'La contraseña no es válida'
  }

  if (password !== undefined && password !== '' && password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres'
  }

  return null
}

function datosPerfil(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    creado_en: usuario.creado_en,
  }
}

// US03: consulta los datos publicos del perfil de un usuario.
// La contrasena nunca se incluye en la respuesta.
export async function obtenerPerfil(req, res, next) {
  try {
    const usuarioId = Number(req.params.id)

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ mensaje: 'El id de usuario debe ser un numero positivo' })
    }

    const { rows } = await query(
      `SELECT id, nombre, email, creado_en
       FROM usuarios
       WHERE id = $1`,
      [usuarioId],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    res.json(rows[0])
  } catch (e) { next(e) }
}

// US04: obtiene el perfil de la cuenta autenticada.
export async function obtenerMiPerfil(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, nombre, email, creado_en
       FROM usuarios
       WHERE id = $1`,
      [req.usuario.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    res.json(rows[0])
  } catch (e) { next(e) }
}

// US04: actualiza los datos de la cuenta autenticada.
export async function actualizarMiPerfil(req, res, next) {
  try {
    const { nombre, email, password } = req.body
    const errorValidacion = validarDatosPerfil({ nombre, email, password })

    if (errorValidacion) {
      return res.status(400).json({ mensaje: errorValidacion })
    }

    const emailNormalizado = email.trim().toLowerCase()
    const existente = await query(
      'SELECT id FROM usuarios WHERE email = $1 AND id <> $2',
      [emailNormalizado, req.usuario.id],
    )

    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'El email ya está registrado' })
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null
    const { rows } = await query(
      `UPDATE usuarios
       SET nombre = $1,
           email = $2,
           password_hash = COALESCE($3, password_hash)
       WHERE id = $4
       RETURNING id, nombre, email, creado_en`,
      [nombre.trim(), emailNormalizado, passwordHash, req.usuario.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    const usuario = rows[0]
    res.json({ usuario: datosPerfil(usuario), token: crearToken(usuario) })
  } catch (e) { next(e) }
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
