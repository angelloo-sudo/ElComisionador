// Opiniones de la comunidad. Cualquiera puede leerlas (portada), pero solo un
// cliente o comisionista con sesión iniciada puede publicar una.
import { query } from '../config/db.js'

const LIMITE = 30

// El nombre se muestra abreviado ("Lucía M.") para no exponer el apellido completo.
function nombrePublico(nombre, apellido) {
  const inicial = String(apellido ?? '').trim().charAt(0)
  return `${String(nombre ?? '').trim()}${inicial ? ` ${inicial.toUpperCase()}.` : ''}`.trim() || 'Usuario de ComiTrack'
}

const aPublica = (fila) => ({
  id: fila.id,
  nombre: nombrePublico(fila.nombre, fila.apellido),
  rol: fila.rol === 'comisionista' ? 'Comisionista' : 'Cliente',
  texto: fila.texto,
  creado_en: fila.creado_en,
})

export async function listar(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT o.id, o.texto, o.creado_en, u.nombre, u.apellido, u.rol
       FROM opiniones o JOIN usuarios u ON u.id = o.usuario_id
       WHERE u.activo = true
       ORDER BY o.creado_en DESC, o.id DESC LIMIT $1`,
      [LIMITE],
    )
    res.json({ opiniones: rows.map(aPublica) })
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim().replace(/\s+/g, ' ') : ''
    if (texto.length < 5) return res.status(400).json({ mensaje: 'Escribí tu opinión (mínimo 5 caracteres)' })
    if (texto.length > 400) return res.status(400).json({ mensaje: 'La opinión no puede superar los 400 caracteres' })
    const { rows } = await query(
      `INSERT INTO opiniones (usuario_id, texto) VALUES ($1, $2)
       RETURNING id, texto, creado_en,
         (SELECT nombre FROM usuarios WHERE id = $1) AS nombre,
         (SELECT apellido FROM usuarios WHERE id = $1) AS apellido,
         (SELECT rol FROM usuarios WHERE id = $1) AS rol`,
      [req.usuario.id, texto],
    )
    res.status(201).json({ opinion: aPublica(rows[0]), mensaje: '¡Gracias! Tu opinión ya está publicada.' })
  } catch (e) { next(e) }
}
