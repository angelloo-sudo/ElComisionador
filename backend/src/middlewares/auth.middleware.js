import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function autenticar(req, res, next) {
  const encabezado = req.headers.authorization
  const [tipo, token] = encabezado?.split(' ') ?? []

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Se requiere autenticación' })
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ mensaje: 'Token inválido o vencido' })
  }
}

// Debe usarse siempre despues de `autenticar` (necesita req.usuario.rol ya cargado).
// Uso: router.post('/', autenticar, permitirRoles('comisionista'), controlador)
export function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'Se requiere autenticación' })
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tenés permisos para realizar esta acción' })
    }

    next()
  }
}
