// US45 - Registrar tipo de gasto / US46 - Modificar tipo de gasto.
import { useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo, Modal } from '../ui.jsx'
import { validarFormTipo } from '../../utils/gastos.js'

// tipo: null para registrar uno nuevo, o el tipo a modificar.
export default function TipoGastoFormModal({ tipo, onClose, onGuardado }) {
  const editando = Boolean(tipo)
  const [form, setForm] = useState({ nombre: tipo?.nombre ?? '', descripcion: tipo?.descripcion ?? '' })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const encontrados = validarFormTipo(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return

    setGuardando(true)
    setErrorGeneral(null)
    const cuerpo = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null }
    try {
      const guardado = editando
        ? await api.put(`/finanzas/tipos-gasto/${tipo.id}`, cuerpo)
        : await api.post('/finanzas/tipos-gasto', cuerpo)
      onGuardado(guardado, editando)
    } catch (err) {
      setErrorGeneral(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal ancho cerrarAlClickFuera={false} onClose={guardando ? undefined : onClose}>
      <h2>{editando ? 'Modificar tipo de gasto' : 'Registrar tipo de gasto'}</h2>
      <p>
        {editando
          ? 'Los gastos que ya tienen este tipo siguen asociados con el nombre nuevo.'
          : 'Los tipos te ayudan a clasificar tus gastos (combustible, peajes, mantenimiento...).'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="form-modal">
        {errorGeneral && (
          <Alerta tipo="error" titulo={editando ? 'No se pudo modificar el tipo de gasto' : 'No se pudo registrar el tipo de gasto'}>{errorGeneral}</Alerta>
        )}
        <Campo label="Nombre" requerido icono="tag" error={errores.nombre}>
          <input
            name="nombre"
            value={form.nombre}
            maxLength={60}
            autoFocus
            placeholder="Ej: Combustible"
            onChange={(e) => cambiar('nombre', e.target.value)}
          />
        </Campo>
        <Campo label="Descripción" opcional="(opcional)" error={errores.descripcion} ayuda="Hasta 200 caracteres.">
          <textarea
            className="area"
            name="descripcion"
            rows={3}
            maxLength={200}
            value={form.descripcion}
            placeholder="Ej: Carga de nafta o GNC"
            onChange={(e) => cambiar('descripcion', e.target.value)}
          />
        </Campo>
        <div className="modal-acciones">
          <button type="button" className="btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar tipo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
