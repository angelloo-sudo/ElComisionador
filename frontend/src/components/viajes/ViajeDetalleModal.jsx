// US12 - Detalle de consulta de un viaje puntual.
import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'
import { Modal, Alerta, BadgeEstado, formatoFecha } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function textoRepeticion(valor) {
  if (!valor) return 'Viaje único'
  if (valor === 'todos') return 'Todos los días'
  return 'Todos los ' + valor.split(',').map((d) => DIAS_CORTOS[Number(d)]).join(', ')
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
          <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion(viaje.repeticion_dias)}</strong></div>
          <div className="resumen-fila"><span>Cupo total</span><strong>{viaje.cupo_total ?? '-'}</strong></div>
          <div className="resumen-fila"><span>Estado</span><BadgeEstado estado={viaje.estado} /></div>
          <div className="resumen-fila"><span>Creado</span><strong>{formatoFecha(viaje.creado_en)}</strong></div>
        </div>
      )}

      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
