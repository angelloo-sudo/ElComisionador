// US43 - Detalle de un gasto para verificar importe y concepto.
import { Modal } from '../ui.jsx'
import Icon from '../Icon.jsx'
import { formatoFechaHora, formatoFechaISO, formatoMoneda } from '../../utils/gastos.js'

function Fila({ etiqueta, children }) {
  return <div className="resumen-fila"><span>{etiqueta}</span><strong>{children || '-'}</strong></div>
}

export default function GastoDetalleModal({ gasto, onClose, onModificar, onBaja }) {
  return (
    <Modal ancho onClose={onClose}>
      <h2>{gasto.tipo_nombre}</h2>
      <p>Detalle del gasto</p>
      <div className="viaje-detalle" style={{ marginTop: 12 }}>
        <Fila etiqueta="Concepto (tipo de gasto)">{gasto.tipo_nombre}</Fila>
        <Fila etiqueta="Monto">{formatoMoneda(gasto.monto)}</Fila>
        <Fila etiqueta="Fecha del gasto">{formatoFechaISO(gasto.fecha)}</Fila>
        <Fila etiqueta="Descripción">{gasto.descripcion}</Fila>
        <Fila etiqueta="Registrado el">{formatoFechaHora(gasto.creado_en)}</Fila>
      </div>
      <div className="modal-acciones">
        <button type="button" className="btn btn-peligro" onClick={() => onBaja(gasto)}>
          <Icon nombre="trash" tamano={15} /> Eliminar
        </button>
        <button type="button" className="btn" onClick={() => onModificar(gasto)}>
          <Icon nombre="pencil" tamano={15} /> Modificar
        </button>
        <button type="button" className="btn btn-primario" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
