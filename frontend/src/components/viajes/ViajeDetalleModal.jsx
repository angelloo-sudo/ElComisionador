// US12 - Detalle de consulta de un viaje puntual.
import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'
import { Modal, Alerta, BadgeEstado, formatoFecha, textoRepeticion } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'

export default function ViajeDetalleModal({ viajeId, onClose, onCancelar, onModificar }) {
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
    <Modal onClose={onClose}>
      <h2>Detalle del viaje{viaje ? ` ${codigoViaje(viaje.id)}` : ''}</h2>

      {cargando && <p>Cargando...</p>}
      {error && <Alerta tipo="error" titulo="No se pudo cargar el viaje">{error}</Alerta>}

      {viaje && (
        <div className="viaje-detalle">
          <div className="resumen-fila"><span>Origen</span><strong>{viaje.origen}</strong></div>
          <div className="resumen-fila"><span>Destino</span><strong>{viaje.destino}</strong></div>
          <div className="resumen-fila"><span>Fecha</span><strong>{formatoFecha(viaje.fecha)}</strong></div>
          <div className="resumen-fila"><span>Hora de salida</span><strong>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</strong></div>
          <div className="resumen-fila"><span>Hora de llegada (aprox.)</span><strong>{viaje.hora_llegada ? viaje.hora_llegada.slice(0, 5) : '-'}</strong></div>
          <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion(viaje.repeticion_dias, viaje.serie_id)}</strong></div>
          <div className="resumen-fila"><span>Reservas activas</span><strong>{viaje.ocupados} / {viaje.cupo_total ?? '-'}</strong></div>
          <div className="resumen-fila"><span>Estado</span><BadgeEstado estado={viaje.estado} /></div>
          <div className="resumen-fila"><span>Creado</span><strong>{formatoFecha(viaje.creado_en)}</strong></div>
          <h3 style={{ marginTop: 18 }}>Pasajeros con reserva</h3>
          {viaje.pasajeros.length === 0 ? (
            <p className="campo-ayuda">Todavía no hay reservas activas para este viaje.</p>
          ) : (
            <ul style={{ margin: '12px 0 0', paddingLeft: 22 }}>
              {viaje.pasajeros.map((nombre, indice) => <li key={`${nombre}-${indice}`}>{nombre}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="modal-acciones">
        {viaje?.estado === 'programado' && onModificar && (
          <button type="button" className="btn" onClick={() => onModificar(viaje)}>Modificar viaje</button>
        )}
        {viaje?.estado === 'programado' && onCancelar && (
          <button type="button" className="btn btn-peligro" onClick={() => onCancelar(viaje)}>Cancelar viaje</button>
        )}
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
