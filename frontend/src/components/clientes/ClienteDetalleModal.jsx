import { useState, useEffect } from 'react'
import { api } from '../../api/client.js'

export default function ClienteDetalleModal({ clienteId, onClose }) {
  const [cliente, setCliente] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    setError(null)
    api.get(`/clientes/${clienteId}`)
      .then(setCliente)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [clienteId])

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Detalle del cliente</h2>

        {cargando && <p>Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {cliente && (
          <div className="cliente-detalle">
            <div><span>Nombre</span><strong>{cliente.nombre}</strong></div>
            <div><span>Apellido</span><strong>{cliente.apellido}</strong></div>
            <div><span>DNI</span><strong>{cliente.dni || '-'}</strong></div>
            <div><span>Teléfono</span><strong>{cliente.telefono || '-'}</strong></div>
            <div><span>Dirección</span><strong>{[cliente.calle, cliente.altura, cliente.barrio].filter(Boolean).join(' ') || '-'}</strong></div>
            <div><span>Descripción</span><strong>{cliente.descripcion || '-'}</strong></div>
            <div><span>Estado</span><strong>{cliente.activo ? 'Activo' : 'Dado de baja'}</strong></div>
            <div><span>Cliente desde</span><strong>{new Date(cliente.creado_en).toLocaleDateString('es-AR')}</strong></div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}