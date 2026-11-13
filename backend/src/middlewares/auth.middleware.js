import jwt from 'jsonwebtoken'
import { query } from '../config/db.js'

const JWT_SECRET = process.env.JWT_SECRET

export function autenticar(req, res, next) {
  const encabezado = req.headers.authorization
  const [tipo, token] = encabezado?.split(' ') ?? []

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Se requiere autenticación' })
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET)
    if (!req.usuario.id || ['verificacion_email', 'verificacion_identidad'].includes(req.usuario.tipo)) {
      return res.status(401).json({ mensaje: 'Token de sesión inválido' })
    }
    if (['cliente', 'comisionista'].includes(req.usuario.rol)) {
      query(`SELECT u.email_verificado, EXISTS (SELECT 1 FROM verificaciones_identidad v WHERE v.usuario_id = u.id AND v.estado = 'APROBADA_MANUALMENTE') AS identidad_aprobada FROM usuarios u WHERE u.id = $1 AND u.activo = true`, [req.usuario.id])
        .then(({ rows }) => {
          if (!rows[0]?.email_verificado) return res.status(403).json({ codigo: 'EMAIL_NO_VERIFICADO', mensaje: 'Verificá tu correo para continuar.' })
          const rutaDeVerificacion = req.baseUrl.endsWith('/verificaciones')
            || (req.baseUrl.endsWith('/auth') && req.method === 'GET' && req.path === '/perfil')
          if (!rows[0]?.identidad_aprobada && !rutaDeVerificacion) return res.status(403).json({ codigo: 'IDENTIDAD_PENDIENTE', mensaje: 'Completá la verificación de identidad y esperá la aprobación administrativa.' })
          next()
        }).catch(next)
      return
    }
    next()
  } catch {
    res.status(401).json({ mensaje: 'Token inválido o vencido' })
  }
}

// El token temporal solo se usa en el flujo de identidad sin sesión; las rutas
// administrativas y el resto de la API siguen exigiendo una sesión habitual.
export function autenticarVerificacion(req, res, next) {
  const encabezado = req.headers.authorization
  const [tipo, token] = encabezado?.split(' ') ?? []
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ mensaje: 'Se requiere autenticación' })
  try {
    const usuario = jwt.verify(token, JWT_SECRET)
    if (!usuario.id || !['cliente', 'comisionista'].includes(usuario.rol)
        || ![undefined, 'verificacion_identidad'].includes(usuario.tipo)) {
      return res.status(401).json({ mensaje: 'Token de verificación no válido' })
    }
    req.usuario = usuario
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
