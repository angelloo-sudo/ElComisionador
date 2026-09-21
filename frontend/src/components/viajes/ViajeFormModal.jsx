// US10 - Formulario de registro de viajes.
import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function ViajeFormModal({ viaje, onClose, onSaved }) {
  const esEdicion = Boolean(viaje)

  const [form, setForm] = useState({
    origen: viaje?.origen ?? '',
    destino: viaje?.destino ?? '',
    fecha: viaje?.fecha ? viaje.fecha.slice(0, 10) : '',
    cupo_total: viaje?.cupo_total ?? '',
  })
  const [horaSel, setHoraSel] = useState(viaje?.hora_salida ? viaje.hora_salida.slice(0, 2) : '')
  const [minutoSel, setMinutoSel] = useState(viaje?.hora_salida ? viaje.hora_salida.slice(3, 5) : '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setForm({
      origen: viaje?.origen ?? '',
      destino: viaje?.destino ?? '',
      fecha: viaje?.fecha ? viaje.fecha.slice(0, 10) : '',
      cupo_total: viaje?.cupo_total ?? '',
    })
    setHoraSel(viaje?.hora_salida ? viaje.hora_salida.slice(0, 2) : '')
    setMinutoSel(viaje?.hora_salida ? viaje.hora_salida.slice(3, 5) : '')
  }, [viaje])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const payload = {
        ...form,
        cupo_total: Number(form.cupo_total),
        hora_salida: `${horaSel}:${minutoSel}`,
      }
      const guardado = esEdicion
        ? await api.put(`/viajes/${viaje.id}`, payload)
        : await api.post('/viajes', payload)
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
        <h2>{esEdicion ? 'Editar viaje' : 'Nuevo viaje'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Origen *
            <input name="origen" value={form.origen} onChange={handleChange} required />
          </label>
          <label>
            Destino *
            <input name="destino" value={form.destino} onChange={handleChange} required />
          </label>
          <label>
            Fecha *
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
          </label>
          <label>
            Hora de salida *
            <div className="hora-selects">
              <select value={horaSel} onChange={(e) => setHoraSel(e.target.value)} required>
                <option value="" disabled>HH</option>
                {HORAS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>:</span>
              <select value={minutoSel} onChange={(e) => setMinutoSel(e.target.value)} required>
                <option value="" disabled>MM</option>
                {MINUTOS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </label>
          <label>
            Cupo total *
            <input type="number" min="1" step="1" name="cupo_total" value={form.cupo_total} onChange={handleChange} required />
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
