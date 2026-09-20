import { useEffect, useState } from 'react'
import { api, guardarSesion } from '../api/client.js'

const formularioInicial = { nombre: '', email: '', password: '', confirmarPassword: '' }

function mensajeDeError(error, fallback) {
  try {
    return JSON.parse(error.message).mensaje ?? fallback
  } catch {
    return fallback
  }
}

export default function Perfil() {
  const [form, setForm] = useState(formularioInicial)
  const [perfil, setPerfil] = useState(null)
  const [estado, setEstado] = useState({ tipo: '', texto: '' })
  const [editando, setEditando] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const datos = await api.get('/auth/perfil')
        setPerfil(datos)
        setForm({ nombre: datos.nombre, email: datos.email, password: '', confirmarPassword: '' })
      } catch (error) {
        setEstado({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo cargar tu perfil.') })
      } finally {
        setCargando(false)
      }
    }

    cargarPerfil()
  }, [])

  function handleChange(event) {
    setForm((actual) => ({ ...actual, [event.target.name]: event.target.value }))
  }

  function validarFormulario() {
    if (!form.nombre.trim() || form.nombre.trim().length > 120) {
      return 'El nombre es obligatorio y debe tener hasta 120 caracteres.'
    }
    if (form.email.trim().length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Ingresá un email válido de hasta 120 caracteres.'
    }
    if (form.password && form.password.length < 6) {
      return 'La nueva contraseña debe tener al menos 6 caracteres.'
    }
    if (form.password !== form.confirmarPassword) {
      return 'Las contraseñas no coinciden.'
    }
    return ''
  }

  async function guardarCambios(event) {
    event.preventDefault()
    const errorValidacion = validarFormulario()
    if (errorValidacion) {
      setEstado({ tipo: 'error', texto: errorValidacion })
      return
    }

    setEstado({ tipo: '', texto: '' })
    setCargando(true)
    try {
      const respuesta = await api.put('/auth/perfil', {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      guardarSesion(respuesta)
      setPerfil(respuesta.usuario)
      setForm({ nombre: respuesta.usuario.nombre, email: respuesta.usuario.email, password: '', confirmarPassword: '' })
      setEditando(false)
      setEstado({ tipo: 'exito', texto: 'Tu perfil se actualizó correctamente.' })
    } catch (error) {
      setEstado({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo actualizar tu perfil.') })
    } finally {
      setCargando(false)
    }
  }

  if (cargando && !perfil) return <section className="perfil"><p>Cargando perfil...</p></section>

  return (
    <section className="perfil">
      <h1>Mi perfil</h1>
      <p>Revisá y actualizá los datos de tu cuenta.</p>

      {estado.texto && <p className={`perfil-estado ${estado.tipo}`} role="alert">{estado.texto}</p>}

      {perfil && !editando && (
        <div className="perfil-datos">
          <div><span>Nombre</span><strong>{perfil.nombre}</strong></div>
          <div><span>Correo electrónico</span><strong>{perfil.email}</strong></div>
          <div><span>Fecha de registro</span><strong>{new Date(perfil.creado_en).toLocaleDateString('es-AR')}</strong></div>
          <button type="button" onClick={() => setEditando(true)}>Editar perfil</button>
        </div>
      )}

      {editando && (
        <form className="perfil-form" onSubmit={guardarCambios}>
          <label>Nombre<input name="nombre" value={form.nombre} onChange={handleChange} maxLength="120" required /></label>
          <label>Correo electrónico<input name="email" type="email" value={form.email} onChange={handleChange} maxLength="120" required /></label>
          <label>Nueva contraseña <span>(opcional)</span><input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" autoComplete="new-password" /></label>
          <label>Repetir contraseña<input name="confirmarPassword" type="password" value={form.confirmarPassword} onChange={handleChange} minLength="6" autoComplete="new-password" /></label>
          <div className="perfil-acciones">
            <button type="submit" disabled={cargando}>{cargando ? 'Guardando...' : 'Guardar cambios'}</button>
            <button type="button" className="perfil-cancelar" onClick={() => setEditando(false)} disabled={cargando}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}
