import { useEffect, useState } from 'react'
import { api, guardarSesion, cerrarSesion } from '../api/client.js'

const formularioInicial = {
  nombre: '', apellido: '', email: '', password: '', confirmarPassword: '',
  dni: '', telefono: '',
}

function mensajeDeError(error, fallback) {
  return error?.message || fallback
}

export default function Perfil({ onCuentaDadaDeBaja }) {
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
        setForm({ ...formularioInicial, ...datos, password: '', confirmarPassword: '' })
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
      const { confirmarPassword, ...datosAEnviar } = form
      const respuesta = await api.put('/auth/perfil', datosAEnviar)
      guardarSesion(respuesta)
      setPerfil(respuesta.usuario)
      setForm({ ...formularioInicial, ...respuesta.usuario, password: '', confirmarPassword: '' })
      setEditando(false)
      setEstado({ tipo: 'exito', texto: 'Tu perfil se actualizó correctamente.' })
    } catch (error) {
      setEstado({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo actualizar tu perfil.') })
    } finally {
      setCargando(false)
    }
  }

  // US11: dar de baja la propia cuenta.
  async function darDeBaja() {
    const confirmar = window.confirm('¿Seguro que querés dar de baja tu cuenta? Esta acción cierra tu sesión.')
    if (!confirmar) return

    try {
      await api.del('/auth/perfil')
      cerrarSesion()
      onCuentaDadaDeBaja?.()
    } catch (error) {
      setEstado({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo dar de baja tu cuenta.') })
    }
  }

  if (cargando && !perfil) return <section className="perfil"><p>Cargando perfil...</p></section>

  const esCliente = perfil?.rol === 'cliente'

  return (
    <section className="perfil">
      <h1>Mi perfil</h1>
      <p>Revisá y actualizá los datos de tu cuenta.</p>

      {estado.texto && <p className={`perfil-estado ${estado.tipo}`} role="alert">{estado.texto}</p>}

      {perfil && !editando && (
        <div className="perfil-datos">
          <div><span>Nombre</span><strong>{perfil.nombre} {perfil.apellido || ''}</strong></div>
          <div><span>Correo electrónico</span><strong>{perfil.email}</strong></div>
          <div><span>Rol</span><strong>{perfil.rol}</strong></div>
          {esCliente && (
            <>
              <div><span>DNI</span><strong>{perfil.dni || '-'}</strong></div>
              <div><span>Teléfono</span><strong>{perfil.telefono || '-'}</strong></div>
            </>
          )}
          <div><span>Fecha de registro</span><strong>{new Date(perfil.creado_en).toLocaleDateString('es-AR')}</strong></div>
          <div className="perfil-acciones">
            <button type="button" onClick={() => setEditando(true)}>Editar perfil</button>
            <button type="button" className="perfil-cancelar" onClick={darDeBaja}>Dar de baja mi cuenta</button>
          </div>
        </div>
      )}

      {editando && (
        <form className="perfil-form" onSubmit={guardarCambios}>
          <label>Nombre<input name="nombre" value={form.nombre} onChange={handleChange} maxLength="120" minLength="3" title='Debe empezar con mayúscula y contener solo letras (ej: "Facundo")' required /></label>
          <label>Apellido<input name="apellido" value={form.apellido} onChange={handleChange} maxLength="120" /></label>
          <label>Correo electrónico<input name="email" type="email" value={form.email} onChange={handleChange} maxLength="120" required /></label>
          <label>Nueva contraseña <span>(opcional)</span><input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" autoComplete="new-password" /></label>
          <label>Repetir contraseña<input name="confirmarPassword" type="password" value={form.confirmarPassword} onChange={handleChange} minLength="6" autoComplete="new-password" /></label>

          {esCliente && (
            <>
              <label>DNI<input name="dni" value={form.dni} onChange={handleChange} required /></label>
              <label>Teléfono<input name="telefono" value={form.telefono} onChange={handleChange} required /></label>
            </>
          )}

          <div className="perfil-acciones">
            <button type="submit" disabled={cargando}>{cargando ? 'Guardando...' : 'Guardar cambios'}</button>
            <button type="button" className="perfil-cancelar" onClick={() => setEditando(false)} disabled={cargando}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}
