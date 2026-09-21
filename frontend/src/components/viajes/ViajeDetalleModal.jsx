// US12 - Detalle de consulta de un viaje puntual.
import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'

const ESTADOS = {
  programado: 'Programado',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export default function ViajeDetalleModal({ viajeId, onClose }) {
  const [viaje, setViaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    setError(null)
    api.get(`/viajes/${viajeId}`)
      .then(setViaje)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [viajeId])

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Detalle del viaje</h2>

        {cargando && <p>Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {viaje && (
          <div className="viaje-detalle">
            <div><span>Origen</span><strong>{viaje.origen}</strong></div>
            <div><span>Destino</span><strong>{viaje.destino}</strong></div>
            <div><span>Fecha</span><strong>{new Date(viaje.fecha).toLocaleDateString('es-AR')}</strong></div>
            <div><span>Hora de salida</span><strong>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</strong></div>
            <div><span>Cupo total</span><strong>{viaje.cupo_total ?? '-'}</strong></div>
            <div><span>Estado</span><strong>{ESTADOS[viaje.estado] ?? viaje.estado}</strong></div>
            <div><span>Creado</span><strong>{new Date(viaje.creado_en).toLocaleDateString('es-AR')}</strong></div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
