// US40 - Registrar gasto / US41 - Modificar gasto / US44 - elegir su tipo de gasto.
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo, Modal } from '../ui.jsx'
import { hoyEnCordoba } from '../../utils/estadoViaje.js'
import { validarFormGasto } from '../../utils/gastos.js'

// gasto: null para registrar uno nuevo, o el gasto a modificar.
// tipos: tipos de gasto del comisionista (el tipo es el concepto del gasto).
export default function GastoFormModal({ gasto, tipos, onClose, onGuardado }) {
  const editando = Boolean(gasto)
  const [form, setForm] = useState({
    monto: gasto?.monto ?? '',
    fecha: gasto?.fecha ?? hoyEnCordoba(),
    descripcion: gasto?.descripcion ?? '',
    tipo_gasto_id: gasto?.tipo_gasto_id ? String(gasto.tipo_gasto_id) : '',
  })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const encontrados = validarFormGasto(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorGeneral(null)
    const cuerpo = {
      monto: String(form.monto).trim(),
      fecha: form.fecha,
      descripcion: form.descripcion.trim() || null,
      tipo_gasto_id: Number(form.tipo_gasto_id),
    }
    try {
      const guardado = editando
        ? await api.put(`/finanzas/gastos/${gasto.id}`, cuerpo)
        : await api.post('/finanzas/gastos', cuerpo)
      onGuardado(guardado, editando)
    } catch (err) {
      setErrorGeneral(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal ancho cerrarAlClickFuera={false} onClose={guardando ? undefined : onClose}>
      <h2>{editando ? 'Modificar gasto' : 'Registrar gasto'}</h2>
      <p>
        {editando
          ? 'Actualizá los datos o el monto del gasto.'
          : 'Registrá un gasto general de tu actividad. El tipo de gasto es su concepto.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="form-modal">
        {errorGeneral && (
          <Alerta tipo="error" titulo={editando ? 'No se pudo modificar el gasto' : 'No se pudo registrar el gasto'}>{errorGeneral}</Alerta>
        )}
        <Campo
          label="Tipo de gasto (concepto)"
          requerido
          icono="tag"
          error={errores.tipo_gasto_id}
          ayuda={tipos.length === 0 ? 'Todavía no tenés tipos de gasto: registralos en la pestaña "Tipos de gasto".' : undefined}
        >
          <select name="tipo_gasto_id" value={form.tipo_gasto_id} autoFocus onChange={(e) => cambiar('tipo_gasto_id', e.target.value)}>
            <option value="">Elegí un tipo de gasto</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <Icon nombre="down" />
        </Campo>
        <div className="grilla-2">
          <Campo label="Monto (ARS)" requerido error={errores.monto}>
            <input
              type="number"
              name="monto"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.monto}
              placeholder="0,00"
              onChange={(e) => cambiar('monto', e.target.value)}
            />
          </Campo>
          <Campo label="Fecha" requerido icono="calendar" error={errores.fecha}>
            <input type="date" name="fecha" value={form.fecha} max={hoyEnCordoba()} onChange={(e) => cambiar('fecha', e.target.value)} />
          </Campo>
        </div>
        <Campo label="Descripción" opcional="(opcional)" error={errores.descripcion} ayuda="Hasta 500 caracteres.">
          <textarea
            className="area"
            name="descripcion"
            rows={3}
            maxLength={500}
            value={form.descripcion}
            placeholder="Detalle adicional del gasto"
            onChange={(e) => cambiar('descripcion', e.target.value)}
          />
        </Campo>
        <div className="modal-acciones">
          <button type="button" className="btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
