// US42 / US48 - Confirmacion de la eliminacion de un gasto o de un tipo de gasto.
import { useState } from 'react'
import Icon from '../Icon.jsx'
import { Alerta, Modal } from '../ui.jsx'

export default function ConfirmarBajaModal({ titulo, children, errorTitulo, deshabilitarConfirmar = false, onConfirmar, onClose }) {
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState(null)

  async function confirmar() {
    setEnCurso(true)
    setError(null)
    try {
      await onConfirmar()
    } catch (err) {
      setError(err.message)
      setEnCurso(false)
    }
  }

  return (
    <Modal onClose={enCurso ? undefined : onClose}>
      <span className="modal-icono"><Icon nombre="trash" tamano={22} /></span>
      <h2>{titulo}</h2>
      {children}
      {error && <div style={{ marginTop: 16 }}><Alerta tipo="error" titulo={errorTitulo}>{error}</Alerta></div>}
      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onClose} disabled={enCurso}>Cancelar</button>
        <button type="button" className="btn btn-peligro" onClick={confirmar} disabled={enCurso || deshabilitarConfirmar}>
          {enCurso ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}
