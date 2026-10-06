import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Modal } from '../components/ui.jsx'

function nombreCompleto(cliente) {
  return `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/clientes')
      .then(setClientes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  const textoBusqueda = busqueda.trim().toLocaleLowerCase('es-AR')
  const clientesFiltrados = clientes.filter((cliente) => {
    if (!textoBusqueda) return true
    return [
      nombreCompleto(cliente), cliente.email, cliente.dni, cliente.telefono,
    ].some((valor) => valor?.toLocaleLowerCase('es-AR').includes(textoBusqueda))
  })

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Clientes</h2>
          <p>Personas vinculadas a tus viajes y encomiendas.</p>
        </div>
        <label className="busqueda-clientes">
          <Icon nombre="search" tamano={16} />
          <input
            type="search"
            aria-label="Buscar clientes"
            placeholder="Buscar por nombre o contacto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los clientes">{error}</Alerta>}

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando clientes...</p>
        ) : clientesFiltrados.length === 0 ? (
          <p className="vacio">
            {clientes.length === 0
              ? 'Todavía no hay clientes vinculados a tus viajes o encomiendas.'
              : 'No se encontraron clientes con esa búsqueda.'}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Cliente</th><th>Email</th><th>Teléfono</th><th></th></tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{nombreCompleto(cliente)}</td>
                  <td>{cliente.email || '-'}</td>
                  <td>{cliente.telefono || '-'}</td>
                  <td>
                    <button type="button" className="btn btn-chico" onClick={() => setClienteSeleccionado(cliente)}>
                      Ver información
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {clienteSeleccionado && (
        <Modal onClose={() => setClienteSeleccionado(null)}>
          <h2>{nombreCompleto(clienteSeleccionado)}</h2>
          <div className="viaje-detalle">
            <div className="resumen-fila"><span>DNI</span><strong>{clienteSeleccionado.dni || 'No informado'}</strong></div>
            <div className="resumen-fila"><span>Email</span><strong>{clienteSeleccionado.email || 'No informado'}</strong></div>
            <div className="resumen-fila"><span>Teléfono</span><strong>{clienteSeleccionado.telefono || 'No informado'}</strong></div>
          </div>
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={() => setClienteSeleccionado(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </section>
  )
}