// US37 - Detalle completo de un ingreso: fecha, monto, metodo de pago, cliente y servicio asociado.
import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { Alerta, Modal } from '../ui.jsx'
import Icon from '../Icon.jsx'
import { formatoFechaHora, formatoFechaISO, formatoMoneda } from '../../utils/gastos.js'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'

function Fila({ etiqueta, children }) {
  return <div className="resumen-fila"><span>{etiqueta}</span><strong>{children || '-'}</strong></div>
}

export default function IngresoDetalleModal({ id, onClose, onModificar, onAnular }) {
  const [i, setI] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { api.get(`/finanzas/ingresos/${id}`).then(setI).catch((e) => setError(e.message)) }, [id])

  return (
    <Modal ancho onClose={onClose}>
      <h2>Detalle del ingreso</h2>
      {error && <Alerta tipo="error" titulo="No se pudo cargar el ingreso">{error}</Alerta>}
      {!i && !error && <p>Cargando...</p>}
      {i && (
        <>
          <div className="viaje-detalle" style={{ marginTop: 12 }}>
            <Fila etiqueta="Monto">{formatoMoneda(i.monto)}</Fila>
            <Fila etiqueta="Fecha">{formatoFechaISO(i.fecha)}</Fila>
            <Fila etiqueta="Método de pago">{i.forma_pago === 'transferencia' ? 'Transferencia' : i.forma_pago === 'efectivo' ? 'Efectivo' : null}</Fila>
            <Fila etiqueta="Cliente">{i.cliente}</Fila>
            <Fila etiqueta="Servicio">{i.tipo_servicio === 'encomienda' ? 'Encomienda' : i.tipo_servicio === 'pasajero' ? 'Pasajero (viaje)' : null}</Fila>
            <Fila etiqueta="Recorrido del servicio">{i.origen_localidad && i.destino_localidad ? `${i.origen_localidad} → ${i.destino_localidad}` : null}</Fila>
            <Fila etiqueta="Viaje">{i.viaje_id ? `${codigoViaje(i.viaje_id)} · ${i.viaje_origen} → ${i.viaje_destino} · ${formatoFechaISO(i.viaje_fecha)}` : null}</Fila>
            <Fila etiqueta="Estado">{i.estado === 'anulado' ? 'Anulado' : 'Vigente'}</Fila>
            {i.estado === 'anulado' && <Fila etiqueta="Anulado el">{formatoFechaHora(i.anulado_en)}</Fila>}
            {i.estado === 'anulado' && <Fila etiqueta="Motivo de la anulación">{i.motivo_anulacion}</Fila>}
            <Fila etiqueta="Registrado el">{formatoFechaHora(i.creado_en)}</Fila>
          </div>
          <div className="modal-acciones">
            {i.estado === 'activo' && (
              <>
                <button type="button" className="btn btn-peligro" onClick={() => onAnular(i)}><Icon nombre="trash" tamano={15} /> Anular</button>
                <button type="button" className="btn" onClick={() => onModificar(i)}><Icon nombre="pencil" tamano={15} /> Modificar</button>
              </>
            )}
            <button type="button" className="btn btn-primario" onClick={onClose}>Cerrar</button>
          </div>
        </>
      )}
    </Modal>
  )
}
