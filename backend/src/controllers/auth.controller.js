// Epica 1: Gestion de Usuarios y Clientes (autenticacion).
// TODO: hashear password (bcrypt) y emitir token (JWT).

import { query } from '../config/db.js'

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

export async function register(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'registro: pendiente de implementar', body: req.body })
  } catch (e) { next(e) }
}

export async function login(req, res, next) {
  try {
    res.status(501).json({ mensaje: 'login: pendiente de implementar' })
  } catch (e) { next(e) }
}
