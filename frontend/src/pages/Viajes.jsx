// Epica 2: Gestion de Viajes - US10 (registrar), US12 (consultar) y US16 (filtrar).
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.js'
import ViajeFormModal from '../components/viajes/ViajeFormModal.jsx'
import ViajeDetalleModal from '../components/viajes/ViajeDetalleModal.jsx'

const ESTADOS = {
  programado: 'Programado',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

const FILTROS_VACIOS = { fecha: '', origen: '', destino: '', estado: '' }

export default function Viajes() {
  const [viajes, setViajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [notificacion, setNotificacion] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [viajeDetalleId, setViajeDetalleId] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)

  const hayFiltrosActivos = Object.values(filtrosAplicados).some(Boolean)

  const cargarViajes = useCallback((filtrosParaBuscar) => {
    setCargando(true)
    setError(null)

    const params = new URLSearchParams()
    Object.entries(filtrosParaBuscar).forEach(([clave, valor]) => {
      if (valor) params.set(clave, valor)
    })
    const query = params.toString() ? `?${params.toString()}` : ''

    api.get(`/viajes${query}`)
      .then(setViajes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargarViajes(filtrosAplicados)
  }, [cargarViajes, filtrosAplicados])

  function mostrarNotificacion(texto) {
    setNotificacion(texto)
    setTimeout(() => setNotificacion(null), 3000)
  }

  function handleNuevo() {
    setModalAbierto(true)
  }

  function handleSaved() {
    cargarViajes(filtrosAplicados)
    mostrarNotificacion('Viaje creado correctamente.')
  }

  function handleFiltroChange(e) {
    setFiltros({ ...filtros, [e.target.name]: e.target.value })
  }

  function handleBuscar(e) {
    e.preventDefault()
    setFiltrosAplicados(filtros)
  }

  function handleLimpiarFiltros() {
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
  }

  return (
    <section>
      <h1>Viajes</h1>
      <button onClick={handleNuevo}>+ Nuevo viaje</button>

      {notificacion && <p className="notificacion exito" role="status">{notificacion}</p>}

      <form className="filtros-viajes" onSubmit={handleBuscar}>
        <label>
          Fecha
          <input type="date" name="fecha" value={filtros.fecha} onChange={handleFiltroChange} />
        </label>
        <label>
          Origen
          <input name="origen" value={filtros.origen} onChange={handleFiltroChange} placeholder="Ej: Córdoba" />
        </label>
        <label>
          Destino
          <input name="destino" value={filtros.destino} onChange={handleFiltroChange} placeholder="Ej: Villa María" />
        </label>
        <label>
          Estado
          <select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>
        <button type="submit">Buscar</button>
        {hayFiltrosActivos && (
          <button type="button" onClick={handleLimpiarFiltros}>Limpiar filtros</button>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      {cargando ? (
        <p>Cargando viajes...</p>
      ) : viajes.length === 0 ? (
        <p>
          {hayFiltrosActivos
            ? 'No se encontraron viajes con esos filtros.'
            : 'Todavía no tenés viajes cargados.'}
        </p>
      ) : (
        <table className="tabla-viajes">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Destino</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cupo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viajes.map((viaje) => (
              <tr key={viaje.id}>
                <td>{viaje.origen}</td>
                <td>{viaje.destino}</td>
                <td>{new Date(viaje.fecha).toLocaleDateString('es-AR')}</td>
                <td>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</td>
                <td>{viaje.cupo_total ?? '-'}</td>
                <td>{ESTADOS[viaje.estado] ?? viaje.estado}</td>
                <td>
                  <button onClick={() => setViajeDetalleId(viaje.id)}>Ver detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <ViajeFormModal
          onClose={() => setModalAbierto(false)}
          onSaved={handleSaved}
        />
      )}

      {viajeDetalleId && (
        <ViajeDetalleModal
          viajeId={viajeDetalleId}
          onClose={() => setViajeDetalleId(null)}
        />
      )}
    </section>
  )
}
