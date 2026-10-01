// US10 - Formulario de registro de viajes (con hora de llegada y repeticion).
import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

// Orden de la semana arrancando en lunes. "valor" coincide con Date.getDay() (0 = domingo).
const DIAS_SEMANA = [
  { valor: 1, corto: 'L', nombre: 'Lunes' },
  { valor: 2, corto: 'M', nombre: 'Martes' },
  { valor: 3, corto: 'Mi', nombre: 'Miércoles' },
  { valor: 4, corto: 'J', nombre: 'Jueves' },
  { valor: 5, corto: 'V', nombre: 'Viernes' },
  { valor: 6, corto: 'S', nombre: 'Sábado' },
  { valor: 0, corto: 'D', nombre: 'Domingo' },
]

function SelectorHora({ hora, minuto, onHora, onMinuto }) {
  return (
    <div className="hora-selects">
      <select value={hora} onChange={(e) => onHora(e.target.value)} required>
        <option value="" disabled>HH</option>
        {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span>:</span>
      <select value={minuto} onChange={(e) => onMinuto(e.target.value)} required>
        <option value="" disabled>MM</option>
        {MINUTOS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

function estadoInicial(viaje) {
  return {
    form: {
      origen: viaje?.origen ?? '',
      destino: viaje?.destino ?? '',
      fecha: viaje?.fecha ? viaje.fecha.slice(0, 10) : '',
      cupo_total: viaje?.cupo_total ?? '',
    },
    salida: [viaje?.hora_salida?.slice(0, 2) ?? '', viaje?.hora_salida?.slice(3, 5) ?? ''],
    llegada: [viaje?.hora_llegada?.slice(0, 2) ?? '', viaje?.hora_llegada?.slice(3, 5) ?? ''],
  }
}

export default function ViajeFormModal({ viaje, onClose, onSaved }) {
  const esEdicion = Boolean(viaje)
  const inicial = estadoInicial(viaje)

  const [form, setForm] = useState(inicial.form)
  const [salida, setSalida] = useState(inicial.salida)
  const [llegada, setLlegada] = useState(inicial.llegada)
  // Repeticion: 'unico' | 'diario' | 'semanal'. Solo aplica al crear (no al editar).
  const [tipoRepeticion, setTipoRepeticion] = useState('unico')
  const [diasSel, setDiasSel] = useState([])
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const nuevo = estadoInicial(viaje)
    setForm(nuevo.form)
    setSalida(nuevo.salida)
    setLlegada(nuevo.llegada)
  }, [viaje])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function toggleDia(valor) {
    setDiasSel((actuales) =>
      actuales.includes(valor) ? actuales.filter((d) => d !== valor) : [...actuales, valor]
    )
  }

  // Cuando el usuario elige "Semanal" y todavia no marco ningun dia, sugerimos el
  // dia de la semana de la fecha del viaje (como hace el calendario del celular).
  function elegirTipo(tipo) {
    setTipoRepeticion(tipo)
    if (tipo === 'semanal' && diasSel.length === 0 && form.fecha) {
      setDiasSel([new Date(`${form.fecha}T00:00:00`).getDay()])
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const horaSalida = `${salida[0]}:${salida[1]}`
    const horaLlegada = `${llegada[0]}:${llegada[1]}`
    if (horaLlegada <= horaSalida) {
      setError('La hora de llegada debe ser posterior a la hora de salida.')
      return
    }
    if (tipoRepeticion === 'semanal' && diasSel.length === 0) {
      setError('Elegí al menos un día de la semana para repetir el viaje.')
      return
    }
    if (tipoRepeticion !== 'unico' && hasta < form.fecha) {
      setError('La fecha "repetir hasta" no puede ser anterior a la fecha del viaje.')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        ...form,
        cupo_total: Number(form.cupo_total),
        hora_salida: horaSalida,
        hora_llegada: horaLlegada,
        ...(!esEdicion && {
          repeticion:
            tipoRepeticion === 'unico'
              ? { tipo: 'unico' }
              : { tipo: tipoRepeticion, dias: tipoRepeticion === 'semanal' ? diasSel : undefined, hasta },
        }),
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
            <SelectorHora hora={salida[0]} minuto={salida[1]} onHora={(h) => setSalida([h, salida[1]])} onMinuto={(m) => setSalida([salida[0], m])} />
          </label>
          <label>
            Hora de llegada (aprox.) *
            <SelectorHora hora={llegada[0]} minuto={llegada[1]} onHora={(h) => setLlegada([h, llegada[1]])} onMinuto={(m) => setLlegada([llegada[0], m])} />
          </label>
          <label>
            Cupo total *
            <input type="number" min="1" step="1" name="cupo_total" value={form.cupo_total} onChange={handleChange} required />
          </label>

          {!esEdicion && (
            <fieldset className="repeticion">
              <legend>Repetir</legend>
              <div className="repeticion-tipos" role="radiogroup" aria-label="Repetición del viaje">
                <button type="button" className={tipoRepeticion === 'unico' ? 'activo' : ''} onClick={() => elegirTipo('unico')}>Una sola vez</button>
                <button type="button" className={tipoRepeticion === 'diario' ? 'activo' : ''} onClick={() => elegirTipo('diario')}>Todos los días</button>
                <button type="button" className={tipoRepeticion === 'semanal' ? 'activo' : ''} onClick={() => elegirTipo('semanal')}>Días de la semana</button>
              </div>

              {tipoRepeticion === 'semanal' && (
                <div className="repeticion-dias" role="group" aria-label="Días de la semana">
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d.valor}
                      type="button"
                      title={d.nombre}
                      aria-pressed={diasSel.includes(d.valor)}
                      className={diasSel.includes(d.valor) ? 'activo' : ''}
                      onClick={() => toggleDia(d.valor)}
                    >
                      {d.corto}
                    </button>
                  ))}
                </div>
              )}

              {tipoRepeticion !== 'unico' && (
                <label>
                  Repetir hasta *
                  <input type="date" value={hasta} min={form.fecha || undefined} onChange={(e) => setHasta(e.target.value)} required />
                </label>
              )}
            </fieldset>
          )}

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
