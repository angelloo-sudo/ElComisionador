import { useState, useEffect } from 'react'
import { api, guardarSesion } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Logo, Campo, CampoPassword, Alerta } from '../components/ui.jsx'

const formularioInicial = { nombre: '', apellido: '', email: '', password: '', confirmarPassword: '', dni: '', telefono: '' }
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validaciones del lado del cliente (los mensajes siguen el prototipo).
function validar(form, modo) {
  const e = {}

  if (modo === 'recuperar') {
    if (!form.email.trim()) e.email = 'Ingresa tu correo electrónico'
    else if (!REGEX_EMAIL.test(form.email.trim())) e.email = 'Ingresa un correo electrónico válido'
    return e
  }

  if (modo === 'restablecer') {
    if (!form.password) e.password = 'Ingresa tu nueva contraseña'
    else if (form.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres'
    if (!form.confirmarPassword) e.confirmarPassword = 'Repite tu contraseña'
    else if (form.password !== form.confirmarPassword) e.confirmarPassword = 'Las contraseñas no coinciden'
    return e
  }

  if (!form.email.trim()) e.email = 'Ingresa tu correo electrónico'
  else if (!REGEX_EMAIL.test(form.email.trim())) e.email = 'Ingresa un correo electrónico válido'
  if (!form.password) e.password = 'Ingresa tu contraseña'

  if (modo === 'register') {
    if (form.nombre.trim().length < 3) e.nombre = 'El nombre es obligatorio (mínimo 3 letras)'
    if (form.apellido.trim().length < 3) e.apellido = 'El apellido es obligatorio (mínimo 3 letras)'
    if (!form.telefono.trim()) e.telefono = 'Ingresa tu número de teléfono'
    const dni = form.dni.replace(/\D/g, '')
    if (!/^\d{7,8}$/.test(dni)) e.dni = 'El DNI debe tener 7 u 8 dígitos'
    if (form.password && form.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres'
    if (!form.confirmarPassword) e.confirmarPassword = 'Repite tu contraseña'
    else if (form.password !== form.confirmarPassword) e.confirmarPassword = 'Las contraseñas no coinciden'
  }
  return e
}

export default function Auth({ onAuthenticated }) {
  // Si llegamos desde el link del mail (/?token=xxx), arrancamos directo en modo
  // "restablecer" en vez de en el login.
  const [tokenDeUrl] = useState(() => new URLSearchParams(window.location.search).get('token'))

  const [modo, setModo] = useState(tokenDeUrl ? 'restablecer' : 'login')
  const [rol, setRol] = useState('cliente') // solo se usa cuando modo === 'register'
  const [form, setForm] = useState(formularioInicial)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState(null) // rol con el que se registro
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false)
  const [restablecimientoExitoso, setRestablecimientoExitoso] = useState(false)
  const [requiereVerificacion, setRequiereVerificacion] = useState(false)
  const [cargandoReenvio, setCargandoReenvio] = useState(false)
  const [mensajeReenvio, setMensajeReenvio] = useState('')
  const [errorReenvio, setErrorReenvio] = useState('')

  const registrando = modo === 'register'

  // Una vez que leímos el token de la URL, lo sacamos de la barra de direcciones
  // (prolijidad: que no quede pegado ahí después de usarlo).
  useEffect(() => {
    if (tokenDeUrl) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [tokenDeUrl])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrores((e) => ({ ...e, [name]: undefined }))
  }

function cambiarModo(nuevo) {
  setModo(nuevo)
  setError(null)
  setErrores({})
  setRegistroExitoso(null)
  setRecuperacionEnviada(false)
  setRestablecimientoExitoso(false)
  setRequiereVerificacion(false)
  setMensajeReenvio('')
  setErrorReenvio('')
  setForm((f) => ({ ...formularioInicial, email: f.email }))
}

  async function reenviarVerificacion() {
    const email = registroExitoso?.email || form.email.trim()
    if (!email) {
      setErrorReenvio('Ingresá tu correo para solicitar un nuevo enlace.')
      return
    }

    setCargandoReenvio(true)
    setMensajeReenvio('')
    setErrorReenvio('')
    try {
      const respuesta = await api.post('/auth/reenviar-verificacion', { email })
      setMensajeReenvio(respuesta.mensaje)
    } catch (err) {
      setErrorReenvio(err.message)
    } finally {
      setCargandoReenvio(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setRequiereVerificacion(false)

    const encontrados = validar(form, modo)
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setError(
        modo === 'register' ? 'Revisa los campos marcados en rojo y vuelve a intentarlo.'
        : modo === 'recuperar' ? 'Completa tu correo electrónico.'
        : modo === 'restablecer' ? 'Revisa los campos marcados en rojo y vuelve a intentarlo.'
        : 'Completa tu correo electrónico y contraseña.',
      )
      return
    }

    setCargando(true)
    try {
      if (modo === 'recuperar') {
        await api.post('/auth/recuperar', { email: form.email })
        setRecuperacionEnviada(true)
        return
      }

      if (modo === 'restablecer') {
        await api.post('/auth/restablecer', { token: tokenDeUrl, password: form.password })
        setRestablecimientoExitoso(true)
        return
      }

      // US11 (cliente) pega a /auth/register; US06 (comisionista) pega a
      // /auth/register-comisionista. El login es el mismo endpoint para cualquier rol.
      const endpoint =
        modo === 'login' ? '/auth/login'
        : rol === 'comisionista' ? '/auth/register-comisionista'
        : '/auth/register'

      const datos = registrando ? { ...form, dni: form.dni.replace(/\D/g, '') } : form
      const respuesta = await api.post(endpoint, datos)

      if (registrando) {
        setRegistroExitoso({ rol, email: respuesta.email ?? form.email, verificacionEnviada: respuesta.verificacionEnviada })
      } else {
        guardarSesion(respuesta)
        onAuthenticated()
      }
    } catch (err) {
      setError(err.message)
      setRequiereVerificacion(err.codigo === 'EMAIL_NO_VERIFICADO')
    } finally {
      setCargando(false)
    }
  }

  if (registroExitoso) {
    return (
      <main className="auth-pagina">
        <div className="auth-card auth-centro">
          <span className={`icono-caja ${registroExitoso.verificacionEnviada ? '' : 'rojo'}`}><Icon nombre={registroExitoso.verificacionEnviada ? 'checkcircle' : 'alert'} tamano={26} /></span>
          <p className="auth-kicker">ComiTrack</p>
          <h1>{registroExitoso.verificacionEnviada ? 'Revisa tu correo' : 'Cuenta creada, falta verificarla'}</h1>
          <p>
            Tu cuenta de {registroExitoso.rol === 'comisionista' ? 'comisionista' : 'cliente'} fue creada para {registroExitoso.email}.
            {registroExitoso.verificacionEnviada
              ? ' Abrí el enlace que te enviamos para verificar el correo; vence en una hora.'
              : ' No pudimos enviar el enlace. Revisá la configuración de correo o solicitá uno nuevo.'}
          </p>
          {mensajeReenvio && <Alerta tipo="exito">{mensajeReenvio}</Alerta>}
          {errorReenvio && <Alerta tipo="error">{errorReenvio}</Alerta>}
          <button type="button" className="btn btn-bloque" onClick={reenviarVerificacion} disabled={cargandoReenvio}>
            {cargandoReenvio ? 'Enviando...' : 'Reenviar enlace de verificación'}
          </button>
          <button type="button" className="btn btn-primario btn-bloque" onClick={() => cambiarModo('login')}>
            Ir a iniciar sesión <Icon nombre="arrow" />
          </button>
        </div>
      </main>
    )
  }

  if (recuperacionEnviada) {
    return (
      <main className="auth-pagina">
        <div className="auth-card auth-centro">
          <span className="icono-caja"><Icon nombre="mail" tamano={26} /></span>
          <p className="auth-kicker">ComiTrack</p>
          <h1>Revisá tu correo</h1>
          <p>
            Si <strong>{form.email}</strong> está registrado en ComiTrack, te enviamos un enlace
            para elegir una nueva contraseña. El enlace vence en 1 hora.
          </p>
          <button type="button" className="btn btn-primario btn-bloque" onClick={() => cambiarModo('login')}>
            Volver a iniciar sesión <Icon nombre="arrow" />
          </button>
        </div>
      </main>
    )
  }

  if (restablecimientoExitoso) {
    return (
      <main className="auth-pagina">
        <div className="auth-card auth-centro">
          <span className="icono-caja"><Icon nombre="checkcircle" tamano={26} /></span>
          <p className="auth-kicker">ComiTrack</p>
          <h1>Contraseña actualizada</h1>
          <p>Tu contraseña se cambió correctamente. Ya podés iniciar sesión con la nueva.</p>
          <button type="button" className="btn btn-primario btn-bloque" onClick={() => cambiarModo('login')}>
            Ir a iniciar sesión <Icon nombre="arrow" />
          </button>
        </div>
      </main>
    )
  }

  if (modo === 'recuperar') {
    return (
      <main className="auth-pagina">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <Logo />
          <h1>Recuperar contraseña</h1>
          <p className="auth-sub">Ingresá tu correo y te mandamos un enlace para elegir una nueva contraseña.</p>

          <div className="auth-form">
            {error && <Alerta tipo="error" titulo="No pudimos enviar el enlace">{error}</Alerta>}

            <Campo label="Correo electrónico" requerido icono="mail" error={errores.email}>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@correo.com" autoComplete="email" />
            </Campo>

            <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando}>
              {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </div>

          <p className="auth-pie">
            <button type="button" onClick={() => cambiarModo('login')}>Volver a iniciar sesión</button>
          </p>
        </form>
      </main>
    )
  }

  if (modo === 'restablecer') {
    return (
      <main className="auth-pagina">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <Logo />
          <h1>Elegí tu nueva contraseña</h1>
          <p className="auth-sub">Ingresá y confirmá tu nueva contraseña para esta cuenta.</p>

          <div className="auth-form">
            {!tokenDeUrl && (
              <Alerta tipo="error" titulo="Enlace inválido">
                Este enlace no es válido o ya fue usado. Pedí uno nuevo desde "Recuperar contraseña".
              </Alerta>
            )}
            {error && <Alerta tipo="error" titulo="No pudimos actualizar la contraseña">{error}</Alerta>}

            <div className="grilla-2">
              <CampoPassword label="Nueva contraseña" requerido name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" autoComplete="new-password" error={errores.password} />
              <CampoPassword label="Confirmar contraseña" requerido name="confirmarPassword" value={form.confirmarPassword} onChange={handleChange} placeholder="Repite la contraseña" autoComplete="new-password" error={errores.confirmarPassword} />
            </div>

            <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando || !tokenDeUrl}>
              {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </div>

          <p className="auth-pie">
            <button type="button" onClick={() => cambiarModo('login')}>Volver a iniciar sesión</button>
          </p>
        </form>
      </main>
    )
  }

  return (
    <main className="auth-pagina">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <Logo />
        <h1>{registrando ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p className="auth-sub">
          {registrando
            ? 'Regístrate para gestionar tus viajes, encomiendas y finanzas.'
            : 'Ingresa con tu correo electrónico y contraseña.'}
        </p>

        <div className="auth-form">
          {registrando && (
            <div className="campo">
              <span className="campo-label">Registrarme como</span>
              <div className="segmentado" role="radiogroup" aria-label="Tipo de cuenta">
                <button type="button" role="radio" aria-checked={rol === 'comisionista'} className={rol === 'comisionista' ? 'activo' : ''} onClick={() => setRol('comisionista')}>
                  <Icon nombre={rol === 'comisionista' ? 'checkcircle' : 'logo'} /> Comisionista
                </button>
                <button type="button" role="radio" aria-checked={rol === 'cliente'} className={rol === 'cliente' ? 'activo' : ''} onClick={() => setRol('cliente')}>
                  <Icon nombre={rol === 'cliente' ? 'checkcircle' : 'user'} /> Cliente
                </button>
              </div>
            </div>
          )}

          {error && <Alerta tipo="error" titulo={registrando ? 'No pudimos crear la cuenta' : 'No pudimos iniciar sesión'}>{error}</Alerta>}
          {!registrando && requiereVerificacion && (
            <button type="button" className="btn" onClick={reenviarVerificacion} disabled={cargandoReenvio}>
              {cargandoReenvio ? 'Enviando...' : 'Reenviar enlace de verificación'}
            </button>
          )}
          {mensajeReenvio && <Alerta tipo="exito">{mensajeReenvio}</Alerta>}
          {errorReenvio && <Alerta tipo="error">{errorReenvio}</Alerta>}

          {registrando && (
            <div className="grilla-2">
              <Campo label="Nombre" requerido error={errores.nombre}>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Tu nombre" autoComplete="given-name" />
              </Campo>
              <Campo label="Apellido" requerido error={errores.apellido}>
                <input name="apellido" value={form.apellido} onChange={handleChange} placeholder="Tu apellido" autoComplete="family-name" />
              </Campo>
            </div>
          )}

          <Campo label="Correo electrónico" requerido icono="mail" error={errores.email}>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@correo.com" autoComplete="email" />
          </Campo>

          {registrando && (
            <div className="grilla-2">
              <Campo label="Teléfono" requerido icono="phone" error={errores.telefono}>
                <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+54 351 456-7890" autoComplete="tel" />
              </Campo>
              <Campo label="DNI" requerido icono="idcard" error={errores.dni}>
                <input name="dni" value={form.dni} onChange={handleChange} inputMode="numeric" placeholder="30.456.789" />
              </Campo>
            </div>
          )}

          {registrando ? (
            <div className="grilla-2">
              <CampoPassword label="Contraseña" requerido name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" autoComplete="new-password" error={errores.password} />
              <CampoPassword label="Confirmar contraseña" requerido name="confirmarPassword" value={form.confirmarPassword} onChange={handleChange} placeholder="Repite la contraseña" autoComplete="new-password" error={errores.confirmarPassword} />
            </div>
          ) : (
            <>
              <CampoPassword label="Contraseña" requerido name="password" value={form.password} onChange={handleChange} placeholder="Tu contraseña" autoComplete="current-password" error={errores.password} />
              <p className="auth-olvide">
                <button type="button" onClick={() => cambiarModo('recuperar')}>¿Olvidaste tu contraseña?</button>
              </p>
            </>
          )}

          <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando}>
            {cargando ? 'Procesando...' : registrando ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </div>

        <p className="auth-pie">
          {registrando ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? '}
          <button type="button" onClick={() => cambiarModo(registrando ? 'login' : 'register')}>
            {registrando ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </form>
    </main>
  )
}