import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/db.js'
import { enviarEmailVerificacion } from '../services/email.service.js'
import {
  validarNombrePropio, validarDni, validarTelefono, validarPresentacion, validarFotoPerfil,
} from '../validators/comunes.validador.js'
import crypto from 'crypto'
import { enviarEmailRecuperacion } from '../services/mail.service.js'

const JWT_SECRET = process.env.JWT_SECRET

// "usuarios" guarda la cuenta (login/rol). "clientes" y "comisionistas" guardan los datos
// propios de cada rol, 1 a 1 con usuarios: una fila en "clientes" solo para cuentas con
// rol = 'cliente', y una en "comisionistas" solo para rol = 'comisionista'.
// Los LEFT JOIN son la unica forma en que el resto del controller "ve" las tablas como
// si fueran una sola: dni/telefono salen de la que corresponda al rol, y las columnas
// que no aplican simplemente vienen en null.
const SELECT_PERFIL = `
  SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.activo, u.creado_en,
         COALESCE(c.dni, m.dni) AS dni,
         COALESCE(c.telefono, m.telefono) AS telefono,
         m.presentacion, m.foto_perfil
  FROM usuarios u
  LEFT JOIN clientes c ON c.usuario_id = u.id
  LEFT JOIN comisionistas m ON m.usuario_id = u.id
`

function crearToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email, rol: usuario.rol }, JWT_SECRET, { expiresIn: '8h' })
}

function crearTokenVerificacion(usuario) {
  return jwt.sign(
    { sub: String(usuario.id), email: usuario.email, rol: usuario.rol, tipo: 'verificacion_email' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
}

async function enviarVerificacion(usuario) {
  await enviarEmailVerificacion({ email: usuario.email, token: crearTokenVerificacion(usuario) })
}

// pideContacto indica si además de nombre/email/password hay que exigir dni/telefono
// (aplica a cuentas con rol 'cliente' y 'comisionista'; el administrador no los tiene).
function validarDatosPerfil({ nombre, apellido, email, password, dni, telefono }, { pideContacto }) {
  const errorNombre = validarNombrePropio(nombre, { etiqueta: 'El nombre' })
  if (errorNombre) return errorNombre

  const errorApellido = validarNombrePropio(apellido, { obligatorio: false, apellidoObligatorio: 'El apellido' })
  if (errorApellido) return errorApellido

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

  if (pideContacto) {
    const errorDni = validarDni(dni)
    if (errorDni) return errorDni

    const errorTelefono = validarTelefono(telefono)
    if (errorTelefono) return errorTelefono
  }

  return null
}

// El shape de salida hacia el frontend es un objeto plano con dni/telefono, aunque por
// dentro salga de un JOIN entre varias tablas. La presentacion y la foto (que pueden
// pesar) solo se incluyen cuando se piden: el login y el registro no las necesitan.
function datosPerfil(fila, { conPerfilPublico = false } = {}) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    email: fila.email,
    rol: fila.rol,
    dni: fila.dni,
    telefono: fila.telefono,
    activo: fila.activo,
    creado_en: fila.creado_en,
    ...(conPerfilPublico && { presentacion: fila.presentacion, foto_perfil: fila.foto_perfil }),
  }
}

async function buscarPerfilPorId(usuarioId) {
  const { rows } = await query(`${SELECT_PERFIL} WHERE u.id = $1`, [usuarioId])
  return rows[0] ?? null
}

// Inserta/actualiza la fila de "clientes" con los datos de contacto. Solo se usa
// cuando el usuario en cuestion tiene rol = 'cliente' (dni/telefono ya validados
// como obligatorios antes de llegar aca).
async function upsertDatosContacto(usuarioId, { dni, telefono }) {
  await query(
    `INSERT INTO clientes (usuario_id, dni, telefono)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id) DO UPDATE SET
       dni = EXCLUDED.dni, telefono = EXCLUDED.telefono`,
    [usuarioId, dni.trim(), telefono.trim()],
  )
}

// Inserta/actualiza la fila de "comisionistas". dni/telefono ya vienen validados como
// obligatorios. presentacion y foto son opcionales: si NO vienen en el pedido
// (undefined) se conservan los valores guardados; si vienen vacios, se borran.
async function upsertDatosComisionista(usuarioId, { dni, telefono, presentacion, foto }) {
  const cambiaPresentacion = presentacion !== undefined
  const cambiaFoto = foto !== undefined
  await query(
    `INSERT INTO comisionistas (usuario_id, dni, telefono, presentacion, foto_perfil)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id) DO UPDATE SET
       dni = EXCLUDED.dni,
       telefono = EXCLUDED.telefono,
       presentacion = CASE WHEN $6::boolean THEN EXCLUDED.presentacion ELSE comisionistas.presentacion END,
       foto_perfil = CASE WHEN $7::boolean THEN EXCLUDED.foto_perfil ELSE comisionistas.foto_perfil END`,
    [
      usuarioId, dni.trim(), telefono.trim(),
      presentacion?.trim() || null, foto || null,
      cambiaPresentacion, cambiaFoto,
    ],
  )
}

// NOTA: el viejo endpoint publico GET /auth/perfil/:id (sin `autenticar`) se elimino:
// permitia consultar el perfil de cualquier usuario sin loguearse. Ahora cada
// usuario solo puede consultar su propia cuenta (ver obtenerMiPerfil).

// US10 (comisionista) / US13 (cliente): consultar los datos de la propia cuenta.
export async function obtenerMiPerfil(req, res, next) {
  try {
    const fila = await buscarPerfilPorId(req.usuario.id)

    if (!fila) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    res.json(datosPerfil(fila, { conPerfilPublico: true }))
  } catch (e) { next(e) }
}

// US09 (comisionista) / US14 (cliente): modificar los datos de la propia cuenta.
// El rol NUNCA se toma del body: no te podés autoascender a comisionista/administrador desde acá.
export async function actualizarMiPerfil(req, res, next) {
  try {
    const { nombre, apellido, email, password, dni, telefono, presentacion, foto_perfil } = req.body
    const esCliente = req.usuario.rol === 'cliente'
    const esComisionista = req.usuario.rol === 'comisionista'

    const errorValidacion = validarDatosPerfil(
      { nombre, apellido, email, password, dni, telefono },
      { pideContacto: esCliente || esComisionista },
    )
    if (errorValidacion) {
      return res.status(400).json({ mensaje: errorValidacion })
    }

    // La presentacion y la foto son solo del comisionista.
    if (esComisionista) {
      const errorExtras = validarPresentacion(presentacion) || validarFotoPerfil(foto_perfil)
      if (errorExtras) {
        return res.status(400).json({ mensaje: errorExtras })
      }
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
       SET nombre = $1, apellido = $2, email = $3,
           password_hash = COALESCE($4, password_hash)
       WHERE id = $5
       RETURNING id, rol`,
      [nombre.trim(), apellido?.trim() || null, emailNormalizado, passwordHash, req.usuario.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    // Los datos propios de cada rol (dni/telefono, y presentacion/foto del comisionista).
    if (rows[0].rol === 'cliente') {
      await upsertDatosContacto(req.usuario.id, { dni, telefono })
    } else if (rows[0].rol === 'comisionista') {
      await upsertDatosComisionista(req.usuario.id, { dni, telefono, presentacion, foto: foto_perfil })
    }

    const perfilActualizado = await buscarPerfilPorId(req.usuario.id)
    res.json({
      usuario: datosPerfil(perfilActualizado, { conPerfilPublico: true }),
      token: crearToken(perfilActualizado),
    })
  } catch (e) { next(e) }
}

// US07 (comisionista) / US12 (cliente): baja de la propia cuenta.
// Segun el criterio de aceptacion, la baja ELIMINA el registro y su informacion
// asociada (no es baja logica). Al borrar el usuario, su fila en "clientes" se
// borra en cascada automaticamente (FK ON DELETE CASCADE), y con ella se sigue la
// cascada hacia lo que dependa de esa tabla. Los viajes del comisionista tambien
// se borran en cascada (FK ON DELETE CASCADE en la tabla viajes).
export async function darDeBajaMiCuenta(req, res, next) {
  try {
    const { rows } = await query(
      `DELETE FROM usuarios WHERE id = $1 RETURNING id`,
      [req.usuario.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    res.json({ mensaje: 'Tu cuenta y la información asociada fueron eliminadas correctamente' })
  } catch (e) { next(e) }
}

// Logica compartida de autorregistro publico. El rol SIEMPRE se fija por parametro
// interno (nunca se toma del body) para que nadie pueda autoasignarse un rol.
async function registrarConRol(req, res, next, rolFijo) {
  try {
    const { nombre, apellido, email, password, confirmarPassword, dni, telefono } = req.body
    const esCliente = rolFijo === 'cliente'

    // Cliente y comisionista deben dejar DNI y telefono al registrarse.
    const errorValidacion = validarDatosPerfil({ nombre, apellido, email, password: password ?? '', dni, telefono }, { pideContacto: true , apellidoObligatorio: true })
    if (errorValidacion) {
      return res.status(400).json({ mensaje: errorValidacion })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña es obligatoria y debe tener al menos 6 caracteres' })
    }

    // Aplica a todos los usuarios que se registran (cliente y comisionista).
    if (confirmarPassword === undefined || confirmarPassword === null || confirmarPassword === '') {
      return res.status(400).json({ mensaje: 'Tenés que repetir la contraseña' })
    }
    if (password !== confirmarPassword) {
      return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' })
    }

    const emailNormalizado = email.trim().toLowerCase()
    const existente = await query('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado])
    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'El email ya está registrado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, email_verificado)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id`,
      [nombre.trim(), apellido?.trim() || null, emailNormalizado, passwordHash, rolFijo],
    )

    const nuevoId = rows[0].id

    // dni/telefono se guardan en la tabla que corresponde al rol. La presentacion y la
    // foto del comisionista se cargan despues, desde su perfil.
    if (esCliente) {
      await upsertDatosContacto(nuevoId, { dni, telefono })
    } else {
      await upsertDatosComisionista(nuevoId, { dni, telefono })
    }

    const perfil = await buscarPerfilPorId(nuevoId)
    let verificacionEnviada = true
    try {
      await enviarVerificacion(perfil)
    } catch (e) {
      verificacionEnviada = false
      console.error('No se pudo enviar el correo de verificación:', e.message)
    }

    res.status(201).json({
      mensaje: 'Cuenta creada. Verificá tu correo antes de iniciar sesión.',
      email: perfil.email,
      verificacionEnviada,
    })
  } catch (e) { next(e) }
}

// US11: autorregistro publico de un cliente.
export async function register(req, res, next) {
  return registrarConRol(req, res, next, 'cliente')
}

// US06: autorregistro publico de un comisionista (misma logica, distinto rol fijo).
// El comisionista ya no puede crear ni gestionar cuentas de otros usuarios.
export async function registerComisionista(req, res, next) {
  return registrarConRol(req, res, next, 'comisionista')
}

export async function verificarEmail(req, res, next) {
  try {
    const { token } = req.body
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ mensaje: 'El enlace de verificación no es válido' })
    }

    let datosToken
    try {
      datosToken = jwt.verify(token, JWT_SECRET)
    } catch (e) {
      const vencido = e.name === 'TokenExpiredError'
      return res.status(vencido ? 410 : 400).json({
        mensaje: vencido ? 'El enlace venció. Solicitá uno nuevo para verificar tu correo.' : 'El enlace de verificación no es válido',
      })
    }

    if (datosToken.tipo !== 'verificacion_email' || !['cliente', 'comisionista'].includes(datosToken.rol)) {
      return res.status(400).json({ mensaje: 'El enlace de verificación no es válido' })
    }

    const actualizacion = await query(
      `UPDATE usuarios
       SET email_verificado = true
       WHERE id = $1 AND email = $2 AND rol = $3 AND activo = true AND email_verificado = false
       RETURNING id`,
      [datosToken.sub, datosToken.email, datosToken.rol],
    )

    if (actualizacion.rowCount === 0) {
      const existente = await query(
        `SELECT email_verificado FROM usuarios
         WHERE id = $1 AND email = $2 AND rol = $3 AND activo = true`,
        [datosToken.sub, datosToken.email, datosToken.rol],
      )
      if (!existente.rows[0]) {
        return res.status(400).json({ mensaje: 'El enlace ya no corresponde a una cuenta activa' })
      }
      if (existente.rows[0].email_verificado) {
        return res.json({ mensaje: 'El correo ya estaba verificado' })
      }
      return res.status(400).json({ mensaje: 'El enlace de verificación no es válido' })
    }

    res.json({ mensaje: 'Correo verificado. Ya podés iniciar sesión.' })
  } catch (e) { next(e) }
}

export async function reenviarVerificacion(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const resultado = await query(
      `SELECT id, email, rol, email_verificado, activo
       FROM usuarios WHERE email = $1 AND rol IN ('cliente', 'comisionista')`,
      [email],
    )
    const usuario = resultado.rows[0]

    if (!usuario || !usuario.activo || usuario.email_verificado) {
      return res.json({ mensaje: 'Si la cuenta existe y necesita verificación, enviaremos un enlace.' })
    }

    try {
      await enviarVerificacion(usuario)
    } catch (e) {
      console.error('No se pudo reenviar el correo de verificación:', e.message)
      return res.status(503).json({ mensaje: 'No se pudo enviar el correo. Revisá la configuración SMTP e intentá de nuevo.' })
    }

    res.json({ mensaje: 'Enviamos un nuevo enlace de verificación.' })
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

    if (!usuario.activo) {
      return res.status(403).json({ mensaje: 'Esta cuenta fue dada de baja' })
    }

    if (!usuario.email_verificado) {
      return res.status(403).json({
        codigo: 'EMAIL_NO_VERIFICADO',
        mensaje: 'Verificá tu correo antes de iniciar sesión.',
      })
    }

    const perfil = await buscarPerfilPorId(usuario.id)
    res.json({ usuario: datosPerfil(perfil), token: crearToken(perfil) })
  } catch (e) { next(e) }
}

const TOKEN_RECUPERACION_VALIDEZ_MINUTOS = 60

function generarTokenRecuperacion() {
  const tokenPlano = crypto.randomBytes(32).toString('hex') // este viaja por mail
  const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex') // este va a la DB
  return { tokenPlano, tokenHash }
}

// Solicitar el envío del email de recuperación.
export async function solicitarRecuperacion(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase()

    // Respuesta genérica siempre, exista o no el email: así este endpoint no sirve
    // para averiguar qué correos están registrados en el sistema.
    const mensajeGenerico = { mensaje: 'Si el email existe en el sistema, te enviamos un enlace para restablecer tu contraseña.' }

    if (!email) {
      return res.status(400).json({ mensaje: 'Ingresá tu email' })
    }

    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1 AND activo = true', [email])
    if (rows.length === 0) {
      return res.json(mensajeGenerico)
    }

    const { tokenPlano, tokenHash } = generarTokenRecuperacion()
    const expira = new Date(Date.now() + TOKEN_RECUPERACION_VALIDEZ_MINUTOS * 60 * 1000)

    await query(
      'UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id = $3',
      [tokenHash, expira, rows[0].id],
    )

    const link = `${process.env.FRONTEND_URL}/?token=${tokenPlano}`
    await enviarEmailRecuperacion(email, link)

    res.json(mensajeGenerico)
  } catch (e) { next(e) }
}

// Restablecer la contraseña usando el token recibido por email.
export async function restablecerPassword(req, res, next) {
  try {
    const { token, password } = req.body

    if (!token) {
      return res.status(400).json({ mensaje: 'Falta el token de recuperación' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const { rows } = await query(
      'SELECT id FROM usuarios WHERE reset_token = $1 AND reset_token_expira > NOW()',
      [tokenHash],
    )

    if (rows.length === 0) {
      return res.status(400).json({ mensaje: 'El enlace de recuperación es inválido o expiró' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await query(
      'UPDATE usuarios SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id = $2',
      [passwordHash, rows[0].id],
    )

    res.json({ mensaje: 'Tu contraseña fue actualizada correctamente. Ya podés iniciar sesión.' })
  } catch (e) { next(e) }
}