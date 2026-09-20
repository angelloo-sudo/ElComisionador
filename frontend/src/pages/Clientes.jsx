import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.js'
import ClienteFormModal from '../components/clientes/ClienteFormModal.jsx'
import ClienteDetalleModal from '../components/clientes/ClienteDetalleModal.jsx'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [clienteDetalleId, setClienteDetalleId] = useState(null)

  const cargarClientes = useCallback(() => {
    setCargando(true)
    setError(null)
    api.get('/clientes')
      .then(setClientes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  function handleNuevo() {
    setClienteEditando(null)
    setModalAbierto(true)
  }

  function handleEditar(cliente) {
    setClienteEditando(cliente)
    setModalAbierto(true)
  }

  function handleSaved() {
    cargarClientes()
  }

  async function handleBaja(cliente) {
    const confirmar = window.confirm(`¿Dar de baja a ${cliente.nombre} ${cliente.apellido}?`)
    if (!confirmar) return

    try {
      await api.del(`/clientes/${cliente.id}`)
      cargarClientes()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <h1>Clientes</h1>
      <button onClick={handleNuevo}>+ Nuevo cliente</button>

      {error && <p className="error">{error}</p>}

      {cargando ? (
        <p>Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <p>Todavía no tenés clientes cargados.</p>
      ) : (
        <table className="tabla-clientes">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.apellido}</td>
                <td>{cliente.telefono || '-'}</td>
                <td>{[cliente.calle, cliente.altura, cliente.barrio].filter(Boolean).join(' ') || '-'}</td>
                <td>
                  <button onClick={() => setClienteDetalleId(cliente.id)}>Ver detalle</button>
                  <button onClick={() => handleEditar(cliente)}>Editar</button>
                  <button onClick={() => handleBaja(cliente)}>Dar de baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <ClienteFormModal
          cliente={clienteEditando}
          onClose={() => setModalAbierto(false)}
          onSaved={handleSaved}
        />
      )}

      {clienteDetalleId && (
        <ClienteDetalleModal
          clienteId={clienteDetalleId}
          onClose={() => setClienteDetalleId(null)}
        />
      )}
    </section>
  )
}