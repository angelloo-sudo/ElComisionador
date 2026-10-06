// US16 - Registrar cancelacion de viaje: pide confirmacion antes de anular el recorrido.
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Modal, Alerta, formatoFecha } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'

const ALCANCES = [
  { valor: 'este', texto: 'Solo este viaje (la serie sigue)' },
  { valor: 'siguientes', texto: 'Este y los siguientes (la serie deja de repetirse)' },
]

export default function CancelarViajeModal({ viaje, onClose, onCancelado }) {
  const [alcance, setAlcance] = useState('este')
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState(null)
  const esSerie = Boolean(viaje.serie_id)
  const ocupados = viaje.ocupados ?? 0

  async function confirmar() {
    setCancelando(true)
    setError(null)
    try {
      const respuesta = await api.patch(`/viajes/${viaje.id}/cancelar`, { alcance })
      onCancelado(respuesta)
    } catch (err) {
      setError(err.message)
      setCancelando(false)
    }
  }

  return (
    <Modal onClose={cancelando ? undefined : onClose}>
      <span className="modal-icono"><Icon nombre="x" tamano={22} /></span>
      <h2>¿Cancelar el viaje {codigoViaje(viaje.id)}?</h2>
      <p>
        {viaje.origen} → {viaje.destino} · {formatoFecha(viaje.fecha)} · {viaje.hora_salida?.slice(0, 5)}
      </p>
      <p style={{ marginTop: 10 }}>
        El viaje pasará a estado <strong style={{ color: 'var(--texto)' }}>Cancelado</strong> y dejará de admitir
        nuevos pasajeros y encomiendas. Esta acción no se puede deshacer.
      </p>

      {ocupados > 0 && (
        <div style={{ marginTop: 16 }}>
          <Alerta tipo="aviso" titulo={`Hay ${ocupados} pasajero${ocupados === 1 ? '' : 's'} asociado${ocupados === 1 ? '' : 's'}`}>
            Avisales de la cancelación por tu cuenta.
          </Alerta>
        </div>
      )}

      {esSerie && (
        <fieldset className="opciones-alcance">
          <legend>Este viaje se repite hasta que lo canceles. ¿Qué querés cancelar?</legend>
          {ALCANCES.map((a) => (
            <label key={a.valor} className={alcance === a.valor ? 'activo' : ''}>
              <input type="radio" name="alcance" value={a.valor} checked={alcance === a.valor} onChange={() => setAlcance(a.valor)} />
              {a.texto}
            </label>
          ))}
        </fieldset>
      )}

      {error && <div style={{ marginTop: 16 }}><Alerta tipo="error" titulo="No se pudo cancelar el viaje">{error}</Alerta></div>}

      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onClose} disabled={cancelando}>Volver</button>
        <button type="button" className="btn btn-peligro" onClick={confirmar} disabled={cancelando}>
          {cancelando ? 'Cancelando...' : 'Cancelar viaje'}
        </button>
      </div>
    </Modal>
  )
}
