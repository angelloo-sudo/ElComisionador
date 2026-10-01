import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/db.js'
import { validarNombrePropio, validarDni, validarTelefono } from '../validators/comunes.validador.js'

const JWT_SECRET = process.env.JWT_SECRET

// "usuarios" guarda la cuenta (login/rol). "clientes" guarda los datos de contacto,
// 1 a 1 con usuarios, y solo existe una fila ahi para cuentas con rol = 'cliente'.
// Este LEFT JOIN es la unica forma en que el resto del controller "ve" ambas tablas
// como si fueran una sola: para comisionista/administrador, las columnas de clientes
// simplemente vienen en null.
const SELECT_PERFIL = `
  SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.activo, u.creado_en,
         c.dni, c.telefono
  FROM usuarios u
  LEFT JOIN clientes c ON c.usuario_id = u.id
`

function crearToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email, rol: usuario.rol }, JWT_SECRET, { expiresIn: '8h' })
}

// esCliente indica si además de nombre/email/password hay que exigir dni/telefono
// (solo aplica a cuentas con rol 'cliente'; comisionista/administrador no los tienen).
function validarDatosPerfil({ nombre, apellido, email, password, dni, telefono }, { esCliente }) {
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

  if (esCliente) {
    const errorDni = validarDni(dni)
    if (errorDni) return errorDni

    const errorTelefono = validarTelefono(telefono)
    if (errorTelefono) return errorTelefono
  }

  return null
}

// El shape de salida hacia el frontend NO cambia (sigue siendo un objeto plano con
// dni/telefono), aunque por dentro salga de un JOIN entre dos tablas.
function datosPerfil(fila) {
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

    res.json(datosPerfil(fila))
  } catch (e) { next(e) }
}

// US09 (comisionista) / US14 (cliente): modificar los datos de la propia cuenta.
// El rol NUNCA se toma del body: no te podés autoascender a comisionista/administrador desde acá.
export async function actualizarMiPerfil(req, res, next) {
  try {
    const { nombre, apellido, email, password, dni, telefono } = req.body
    const esCliente = req.usuario.rol === 'cliente'

    const errorValidacion = validarDatosPerfil({ nombre, apellido, email, password, dni, telefono }, { esCliente })
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
       SET nombre = $1, apellido = $2, email = $3,
           password_hash = COALESCE($4, password_hash)
       WHERE id = $5
       RETURNING id, rol`,
      [nombre.trim(), apellido?.trim() || null, emailNormalizado, passwordHash, req.usuario.id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    // Los datos de contacto (dni/telefono) solo existen para el rol cliente.
    if (rows[0].rol === 'cliente') {
      await upsertDatosContacto(req.usuario.id, { dni, telefono })
    }

    const perfilActualizado = await buscarPerfilPorId(req.usuario.id)
    res.json({ usuario: datosPerfil(perfilActualizado), token: crearToken(perfilActualizado) })
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

    const errorValidacion = validarDatosPerfil({ nombre, apellido, email, password: password ?? '', dni, telefono }, { esCliente , apellidoObligatorio: true })
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
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [nombre.trim(), apellido?.trim() || null, emailNormalizado, passwordHash, rolFijo],
    )

    const nuevoId = rows[0].id

    // Los campos de contacto (dni/telefono) solo se guardan para clientes.
    if (esCliente) {
      await upsertDatosContacto(nuevoId, { dni, telefono })
    }

    const perfil = await buscarPerfilPorId(nuevoId)
    res.status(201).json({ usuario: datosPerfil(perfil), token: crearToken(perfil) })
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

    const perfil = await buscarPerfilPorId(usuario.id)
    res.json({ usuario: datosPerfil(perfil), token: crearToken(perfil) })
  } catch (e) { next(e) }
}
