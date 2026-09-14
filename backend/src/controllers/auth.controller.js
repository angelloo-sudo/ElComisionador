// Epica 1: Gestion de Usuarios y Clientes (autenticacion).
// TODO: hashear password (bcrypt) y emitir token (JWT).

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
