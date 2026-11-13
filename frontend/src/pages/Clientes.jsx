import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Modal } from '../components/ui.jsx'

function nombreCompleto(cliente) {
  return `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()
}

function FilaDetalle({ etiqueta, children }) {
  return <div className="resumen-fila"><span>{etiqueta}</span><strong>{children || 'No informado'}</strong></div>
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [detalleCliente, setDetalleCliente] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/clientes')
      .then(setClientes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!clienteSeleccionado) return undefined

    let vigente = true
    setDetalleCliente(null)
    setErrorDetalle('')
    setCargandoDetalle(true)
    api.get(`/clientes/${clienteSeleccionado.id}`)
      .then((detalle) => {
        if (vigente) setDetalleCliente(detalle)
      })
      .catch((err) => {
        if (vigente) setErrorDetalle(err.message || 'No se pudo cargar la información del cliente.')
      })
      .finally(() => {
        if (vigente) setCargandoDetalle(false)
      })

    return () => { vigente = false }
  }, [clienteSeleccionado])

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
        <div className="busqueda-clientes">
          <Icon nombre="search" tamano={16} />
          <input
            type="search"
            aria-label="Buscar clientes por nombre, email, DNI o teléfono"
            placeholder="Nombre, email, DNI o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              className="busqueda-clientes-limpiar"
              aria-label="Limpiar búsqueda"
              onClick={() => setBusqueda('')}
            >
              <Icon nombre="x" tamano={15} />
            </button>
          )}
        </div>
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
          <h2>{nombreCompleto(detalleCliente?.cliente ?? clienteSeleccionado)}</h2>
          {cargandoDetalle ? (
            <p className="vacio">Cargando información del cliente...</p>
          ) : errorDetalle ? (
            <Alerta tipo="error" titulo="No se pudo cargar la información">{errorDetalle}</Alerta>
          ) : detalleCliente && (
            <>
              <h3>Datos del cliente</h3>
              <div className="viaje-detalle">
                <FilaDetalle etiqueta="DNI">{detalleCliente.cliente.dni}</FilaDetalle>
                <FilaDetalle etiqueta="Email">{detalleCliente.cliente.email}</FilaDetalle>
                <FilaDetalle etiqueta="Teléfono">{detalleCliente.cliente.telefono}</FilaDetalle>
              </div>
            </>
          )}
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={() => setClienteSeleccionado(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </section>
  )
}