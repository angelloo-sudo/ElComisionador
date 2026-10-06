// Epica 2: Gestion de Viajes - US10 (registrar), US12 (consultar) y US16 (filtrar).
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'
import ViajeDetalleModal from '../components/viajes/ViajeDetalleModal.jsx'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, BadgeEstado, ESTADOS_VIAJE, formatoFecha } from '../components/ui.jsx'
import { codigoViaje } from './ViajeNuevo.jsx'

const FILTROS_VACIOS = { fecha: '', origen: '', destino: '', estado: '' }

export default function Viajes() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [viajes, setViajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  // Si venimos de "Ver viaje" (tras registrar uno), se abre su detalle directamente.
  const [viajeDetalleId, setViajeDetalleId] = useState(ubicacion.state?.abrirId ?? null)
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
      <div className="barra-pagina">
        <div>
          <h2>Mis viajes</h2>
          <p>Consultá y filtrá los viajes que tenés programados.</p>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => navegar('/viajes/nuevo')}>
          <Icon nombre="plus" tamano={16} /> Registrar viaje
        </button>
      </div>

      <form className="card filtros" onSubmit={handleBuscar}>
        <Campo label="Fecha" icono="calendar">
          <input type="date" name="fecha" value={filtros.fecha} onChange={handleFiltroChange} />
        </Campo>
        <Campo label="Origen" icono="pin">
          <input name="origen" value={filtros.origen} onChange={handleFiltroChange} placeholder="Ej: Córdoba" />
        </Campo>
        <Campo label="Destino" icono="pin">
          <input name="destino" value={filtros.destino} onChange={handleFiltroChange} placeholder="Ej: Villa María" />
        </Campo>
        <Campo label="Estado">
          <select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS_VIAJE).map(([valor, e]) => (
              <option key={valor} value={valor}>{e.texto}</option>
            ))}
          </select>
          <Icon nombre="down" />
        </Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltrosActivos && <button type="button" className="btn" onClick={handleLimpiarFiltros}>Limpiar</button>}
        </div>
      </form>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los viajes">{error}</Alerta>}

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando viajes...</p>
        ) : viajes.length === 0 ? (
          <p className="vacio">
            {hayFiltrosActivos
              ? 'No se encontraron viajes con esos filtros.'
              : 'Todavía no tenés viajes cargados.'}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Recorrido</th>
                <th>Fecha</th>
                <th>Salida</th>
                <th>Llegada</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((viaje) => (
                <tr key={viaje.id}>
                  <td className="codigo">{codigoViaje(viaje.id)}</td>
                  <td>{viaje.origen}<span className="flecha">→</span>{viaje.destino}</td>
                  <td>{formatoFecha(viaje.fecha)}</td>
                  <td>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</td>
                  <td>{viaje.hora_llegada ? viaje.hora_llegada.slice(0, 5) : '-'}</td>
                  <td>{viaje.ocupados ?? 0} / {viaje.cupo_total ?? '-'}</td>
                  <td><BadgeEstado estado={viaje.estado} /></td>
                  <td>
                    <button type="button" className="btn btn-chico" onClick={() => setViajeDetalleId(viaje.id)}>Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viajeDetalleId && (
        <ViajeDetalleModal
          viajeId={viajeDetalleId}
          onClose={() => setViajeDetalleId(null)}
        />
      )}
    </section>
  )
}
