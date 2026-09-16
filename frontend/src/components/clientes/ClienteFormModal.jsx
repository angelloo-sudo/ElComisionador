import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'

export default function ClienteFormModal({ cliente, onClose, onSaved }) {
  const esEdicion = Boolean(cliente)

  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? '',
    apellido: cliente?.apellido ?? '',
    dni: cliente?.dni ?? '',
    telefono: cliente?.telefono ?? '',
    barrio: cliente?.barrio ?? '',
    calle: cliente?.calle ?? '',
    altura: cliente?.altura ?? '',
    descripcion: cliente?.descripcion ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setForm({
      nombre: cliente?.nombre ?? '',
      apellido: cliente?.apellido ?? '',
      dni: cliente?.dni ?? '',
      telefono: cliente?.telefono ?? '',
      barrio: cliente?.barrio ?? '',
      calle: cliente?.calle ?? '',
      altura: cliente?.altura ?? '',
      descripcion: cliente?.descripcion ?? '',
    })
  }, [cliente])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const guardado = esEdicion
        ? await api.put(`/clientes/${cliente.id}`, form)
        : await api.post('/clientes', form)
      onSaved(guardado)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{esEdicion ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Nombre *
            <input name="nombre" value={form.nombre} onChange={handleChange} required />
          </label>
          <label>
            Apellido *
            <input name="apellido" value={form.apellido} onChange={handleChange} required />
          </label>
          <label>
            DNI
            <input name="dni" value={form.dni} onChange={handleChange} />
          </label>
          <label>
            Telefono
            <input name="telefono" value={form.telefono} onChange={handleChange} />
          </label>
          <label>
            Barrio
            <input name="barrio" value={form.barrio} onChange={handleChange} />
          </label>
          <label>
            Calle
            <input name="calle" value={form.calle} onChange={handleChange} />
          </label>
          <label>
            Altura
            <input name="altura" value={form.altura} onChange={handleChange} />
          </label>
          <label>
            Descripcion
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange} />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}