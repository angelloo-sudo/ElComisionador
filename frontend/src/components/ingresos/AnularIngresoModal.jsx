// US39 - Confirmacion explicita de la anulacion de un ingreso (baja logica).
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo, Modal } from '../ui.jsx'
import { formatoFechaISO, formatoMoneda } from '../../utils/gastos.js'

export default function AnularIngresoModal({ ingreso, onClose, onAnulado }) {
  const [motivo, setMotivo] = useState('')
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState(null)

  async function confirmar() {
    setEnCurso(true); setError(null)
    try {
      await api.patch(`/finanzas/ingresos/${ingreso.id}/anular`, { motivo: motivo.trim() || null })
      onAnulado()
    } catch (e) { setError(e.message); setEnCurso(false) }
  }

  return (
    <Modal onClose={enCurso ? undefined : onClose}>
      <span className="modal-icono"><Icon nombre="trash" tamano={22} /></span>
      <h2>¿Anular este ingreso?</h2>
      <p>{ingreso.concepto} · {formatoMoneda(ingreso.monto)} · {formatoFechaISO(ingreso.fecha)}</p>
      <p style={{ marginTop: 10 }}>Deja de sumar en los totales de ingresos. El registro se conserva como anulado.</p>
      <div style={{ marginTop: 14 }}>
        <Campo label="Motivo" opcional="(opcional)" ayuda="Hasta 300 caracteres.">
          <textarea className="area" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: cobro cargado por error" />
        </Campo>
      </div>
      {error && <div style={{ marginTop: 16 }}><Alerta tipo="error" titulo="No se pudo anular el ingreso">{error}</Alerta></div>}
      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onClose} disabled={enCurso}>Cancelar</button>
        <button type="button" className="btn btn-peligro" onClick={confirmar} disabled={enCurso}>{enCurso ? 'Anulando...' : 'Anular ingreso'}</button>
      </div>
    </Modal>
  )
}
