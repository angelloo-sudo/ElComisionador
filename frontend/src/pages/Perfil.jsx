import { useState } from 'react'
import { api } from '../api/client.js'

const usuarioGuardado = localStorage.getItem('usuarioId') ?? ''

export default function Perfil() {
  const [usuarioId, setUsuarioId] = useState(usuarioGuardado)
  const [perfil, setPerfil] = useState(null)
  const [estado, setEstado] = useState('')

  async function consultarPerfil(event) {
    event.preventDefault()
    const id = usuarioId.trim()

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      setPerfil(null)
      setEstado('Ingresá un ID de usuario válido.')
      return
    }

    setEstado('Consultando...')
    setPerfil(null)

    try {
      const datos = await api.get(`/auth/perfil/${id}`)
      localStorage.setItem('usuarioId', id)
      setPerfil(datos)
      setEstado('')
    } catch (error) {
      let mensaje = 'No se pudo obtener la información del perfil.'
      try {
        mensaje = JSON.parse(error.message).mensaje ?? mensaje
      } catch {
        // La API puede devolver un mensaje de texto plano.
      }
      setEstado(mensaje)
    }
  }

  return (
    <section className="perfil">
      <h1>Mi perfil</h1>
      <p>Consultá los datos registrados de tu cuenta.</p>

      <form className="perfil-form" onSubmit={consultarPerfil}>
        <label htmlFor="usuarioId">ID de usuario</label>
        <div>
          <input
            id="usuarioId"
            type="number"
            min="1"
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
            placeholder="Ej.: 1"
            required
          />
          <button type="submit">Consultar perfil</button>
        </div>
      </form>

      {estado && <p className="perfil-estado" role="alert">{estado}</p>}

      {perfil && (
        <dl className="perfil-datos">
          <div><dt>Nombre</dt><dd>{perfil.nombre}</dd></div>
          <div><dt>Correo electrónico</dt><dd>{perfil.email}</dd></div>
          <div><dt>Fecha de registro</dt><dd>{new Date(perfil.creado_en).toLocaleDateString('es-AR')}</dd></div>
        </dl>
      )}
    </section>
  )
}
