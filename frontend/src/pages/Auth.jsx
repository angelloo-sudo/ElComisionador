import { useState } from 'react'
import { api, guardarSesion } from '../api/client.js'

const formularioInicial = { nombre: '', apellido: '', email: '', password: '', confirmarPassword: '', dni: '', telefono: '' }

export default function Auth({ onAuthenticated }) {
  const [modo, setModo] = useState('login')
  const [rol, setRol] = useState('cliente') // solo se usa cuando modo === 'register'
  const [form, setForm] = useState(formularioInicial)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState(false)

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (modo === 'register' && form.password !== form.confirmarPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)

    try {
      // US11 (cliente) pega a /auth/register; US06 (comisionista) pega a
      // /auth/register-comisionista. El login es el mismo endpoint para cualquier rol.
      const endpoint =
        modo === 'login' ? '/auth/login'
        : rol === 'comisionista' ? '/auth/register-comisionista'
        : '/auth/register'

      // El comisionista no tiene ficha de contacto (dni/telefono), asi que no
      // hace falta mandarlos si se está registrando con ese rol.
      const body = modo === 'register' && rol === 'comisionista'
  ? { nombre: form.nombre, apellido: form.apellido, email: form.email, password: form.password, confirmarPassword: form.confirmarPassword }
  : form

      const respuesta = await api.post(endpoint, body)
      guardarSesion(respuesta)

      if (modo === 'register') {
        // Mostramos la confirmación un instante antes de entrar a la app, para
        // que el registro no se sienta "silencioso".
        setRegistroExitoso(true)
        setTimeout(() => onAuthenticated(), 900)
      } else {
        onAuthenticated()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const registrando = modo === 'register'

  return (
    <main className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>ComiTrack</h1>
        <h2>{registrando ? 'Crear cuenta' : 'Iniciar sesión'}</h2>

        {registroExitoso && (
          <p className="notificacion exito" role="status">
            ¡Cuenta creada correctamente! Ingresando...
          </p>
        )}

        {registrando && (
          <div className="auth-rol-selector" role="radiogroup" aria-label="Tipo de cuenta">
            <button
              type="button"
              className={rol === 'cliente' ? 'activo' : ''}
              onClick={() => setRol('cliente')}
            >
              Soy cliente
            </button>
            <button
              type="button"
              className={rol === 'comisionista' ? 'activo' : ''}
              onClick={() => setRol('comisionista')}
            >
              Soy comisionista
            </button>
          </div>
        )}

        {registrando && (
      <>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={handleChange} minLength="3" required />
        </label>
        <label>
          Apellido
          <input name="apellido" value={form.apellido} onChange={handleChange} minLength="3" required />
        </label>
      </>
        )}
          <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" required />
        </label>

        {registrando && (
          <label>
            Repetir contraseña
            <input
              name="confirmarPassword"
              type="password"
              value={form.confirmarPassword}
              onChange={handleChange}
              minLength="6"
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {registrando && rol === 'cliente' && (
          <>
            <label>
              DNI
              <input name="dni" value={form.dni} onChange={handleChange} inputMode="numeric" required />
            </label>
            <label>
              Teléfono
              <input name="telefono" value={form.telefono} onChange={handleChange} required />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Procesando...' : registrando ? 'Registrarme' : 'Ingresar'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setModo(registrando ? 'login' : 'register')
            setError(null)
            setForm((f) => ({ ...f, confirmarPassword: '' }))
          }}
        >
          {registrando ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
        </button>
      </form>
    </main>
  )
}
