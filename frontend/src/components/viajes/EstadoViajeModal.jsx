// US20 / US21 - Iniciar o finalizar un viaje: pide confirmacion antes de cambiar el estado.
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Modal, Alerta, formatoFecha } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'

const ACCIONES = {
  iniciar: {
    titulo: 'Iniciar viaje',
    pregunta: '¿Iniciar el viaje',
    icono: 'checkcircle',
    detalle: 'El viaje pasará a estado En curso y quedará registrado el comienzo del trayecto. Mientras esté en curso no vas a poder iniciar otro viaje.',
    boton: 'Iniciar viaje',
    enCurso: 'Iniciando...',
    error: 'No se pudo iniciar el viaje',
  },
  finalizar: {
    titulo: 'Finalizar viaje',
    pregunta: '¿Finalizar el viaje',
    icono: 'checkcircle',
    detalle: 'El viaje pasará a estado Finalizado y quedará registrado el fin del recorrido. Esta acción no se puede deshacer.',
    boton: 'Finalizar viaje',
    enCurso: 'Finalizando...',
    error: 'No se pudo finalizar el viaje',
  },
}

export default function EstadoViajeModal({ accion, viaje, onClose, onConfirmado }) {
  const config = ACCIONES[accion]
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await api.patch(`/viajes/${viaje.id}/${accion}`, {})
      onConfirmado(respuesta)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={enviando ? undefined : onClose}>
      <span className="modal-icono"><Icon nombre={config.icono} tamano={22} /></span>
      <h2>{config.pregunta} {codigoViaje(viaje.id)}?</h2>
      <p>
        {viaje.origen} → {viaje.destino} · {formatoFecha(viaje.fecha)} · {viaje.hora_salida?.slice(0, 5)}
      </p>
      <p style={{ marginTop: 10 }}>{config.detalle}</p>

      {error && <div style={{ marginTop: 16 }}><Alerta tipo="error" titulo={config.error}>{error}</Alerta></div>}

      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onClose} disabled={enviando}>Volver</button>
        <button type="button" className="btn btn-primario" onClick={confirmar} disabled={enviando}>
          {enviando ? config.enCurso : config.boton}
        </button>
      </div>
    </Modal>
  )
}
