// US38 - Modificar un ingreso (monto, fecha y metodo de pago).
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo, Modal } from '../ui.jsx'
import { hoyEnCordoba } from '../../utils/estadoViaje.js'

export default function IngresoFormModal({ ingreso, onClose, onGuardado }) {
  const [form, setForm] = useState({ monto: ingreso.monto, fecha: ingreso.fecha, forma_pago: ingreso.forma_pago ?? '' })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) { setForm((f) => ({ ...f, [campo]: valor })); setErrores((e) => ({ ...e, [campo]: undefined })) }

  async function enviar(e) {
    e.preventDefault()
    const err = {}
    const monto = String(form.monto).trim()
    if (!monto) err.monto = 'El monto es obligatorio'
    else if (!/^\d+(\.\d{1,2})?$/.test(monto) || Number(monto) <= 0) err.monto = 'El monto debe ser un número mayor a cero, con hasta 2 decimales'
    else if (Number(monto) > 9_999_999_999.99) err.monto = 'El monto es demasiado grande'
    if (!form.fecha) err.fecha = 'La fecha es obligatoria'
    else if (form.fecha > hoyEnCordoba()) err.fecha = 'La fecha no puede ser posterior a hoy'
    if (!form.forma_pago) err.forma_pago = 'Elegí la forma de pago'
    setErrores(err)
    if (Object.keys(err).length) return
    setGuardando(true); setErrorGeneral(null)
    try {
      await api.put(`/finanzas/ingresos/${ingreso.id}`, { monto, fecha: form.fecha, forma_pago: form.forma_pago })
      onGuardado()
    } catch (er) { setErrorGeneral(er.message); setGuardando(false) }
  }

  return (
    <Modal ancho cerrarAlClickFuera={false} onClose={guardando ? undefined : onClose}>
      <h2>Modificar ingreso</h2>
      <p>{ingreso.concepto}. Corregí el monto, la fecha o el método de pago.</p>
      <form onSubmit={enviar} noValidate className="form-modal">
        {errorGeneral && <Alerta tipo="error" titulo="No se pudo modificar el ingreso">{errorGeneral}</Alerta>}
        <div className="grilla-2">
          <Campo label="Monto (ARS)" requerido error={errores.monto}>
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.monto} autoFocus onChange={(e) => cambiar('monto', e.target.value)} />
          </Campo>
          <Campo label="Fecha" requerido icono="calendar" error={errores.fecha}>
            <input type="date" value={form.fecha} max={hoyEnCordoba()} onChange={(e) => cambiar('fecha', e.target.value)} />
          </Campo>
        </div>
        <Campo label="Método de pago" requerido error={errores.forma_pago}>
          <select value={form.forma_pago} onChange={(e) => cambiar('forma_pago', e.target.value)}>
            <option value="">Elegí una opción</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
          </select><Icon nombre="down" />
        </Campo>
        <div className="modal-acciones">
          <button type="button" className="btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
