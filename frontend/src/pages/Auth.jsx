import { useState } from 'react'
import { api, guardarSesion } from '../api/client.js'

export default function Auth({ onAuthenticated }) {
  const [modo, setModo] = useState('login')
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setCargando(true)

    try {
      const respuesta = await api.post(`/auth/${modo}`, form)
      guardarSesion(respuesta)
      onAuthenticated()
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

        {registrando && (
          <label>
            Nombre
            <input name="nombre" value={form.nombre} onChange={handleChange} required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" required />
        </label>

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
          }}
        >
          {registrando ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
        </button>
      </form>
    </main>
  )
}
