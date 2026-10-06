// Epica 2: Gestion de Viajes - US10 (registrar), US12 (consultar) y US16 (filtrar).
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'
import ViajeDetalleModal from '../components/viajes/ViajeDetalleModal.jsx'
import CancelarViajeModal from '../components/viajes/CancelarViajeModal.jsx'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, Toast, BadgeEstado, ESTADOS_VIAJE, formatoFecha, textoRepeticion } from '../components/ui.jsx'
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
  const [viajeACancelar, setViajeACancelar] = useState(null)
  const [toast, setToast] = useState(() => ubicacion.state?.aviso ?? null)
  // US18: aviso visual para el comisionista cuando el viaje modificado tiene clientes asociados.
  const [alertaClientes, setAlertaClientes] = useState(() => ubicacion.state?.alertaClientes ?? null)
  const cerrarToast = useCallback(() => setToast(null), [])
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

  // Limpia el state de la navegacion para que no reaparezca al refrescar.
  useEffect(() => {
    if (ubicacion.state?.aviso || ubicacion.state?.alertaClientes || ubicacion.state?.abrirId) {
      navegar(ubicacion.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarViajes(filtrosAplicados)
  }, [cargarViajes, filtrosAplicados])

  // US16: el viaje ya se cancelo en el backend; se recarga la lista y se avisa.
  function handleCancelado(respuesta) {
    const cancelado = viajeACancelar
    setViajeACancelar(null)
    setViajeDetalleId(null)
    cargarViajes(filtrosAplicados)
    setToast(
      respuesta.cantidad > 1
        ? { titulo: 'Viajes cancelados', texto: `Se cancelaron ${respuesta.cantidad} viajes de la serie.` }
        : { titulo: 'Viaje cancelado', texto: `El viaje ${codigoViaje(cancelado.id)} pasó a estado Cancelado.` }
    )
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

      {alertaClientes && (
        <Alerta tipo="aviso" titulo={alertaClientes.titulo} onCerrar={() => setAlertaClientes(null)}>{alertaClientes.texto}</Alerta>
      )}

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
                  <td className="col-recorrido">
                    {viaje.origen}<span className="flecha">→</span>{viaje.destino}
                    {viaje.serie_id && (
                      <span className="tag-serie" title={textoRepeticion(viaje.repeticion_dias, viaje.serie_id)}>
                        <Icon nombre="repeat" tamano={13} /> Se repite
                      </span>
                    )}
                  </td>
                  <td>{formatoFecha(viaje.fecha)}</td>
                  <td>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</td>
                  <td>{viaje.hora_llegada ? viaje.hora_llegada.slice(0, 5) : '-'}</td>
                  <td>{viaje.ocupados ?? 0} / {viaje.cupo_total ?? '-'}</td>
                  <td><BadgeEstado estado={viaje.estado} /></td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="btn btn-chico" onClick={() => setViajeDetalleId(viaje.id)}>Ver detalle</button>
                      {viaje.estado === 'programado' && (
                        <button type="button" className="btn btn-chico" onClick={() => navegar(`/viajes/${viaje.id}/editar`)}>
                          <Icon nombre="pencil" tamano={13} /> Modificar
                        </button>
                      )}
                      {viaje.estado === 'programado' && (
                        <button type="button" className="btn btn-chico btn-peligro" onClick={() => setViajeACancelar(viaje)}>Cancelar</button>
                      )}
                    </div>
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
          onCancelar={(viaje) => setViajeACancelar(viaje)}
          onModificar={(viaje) => navegar(`/viajes/${viaje.id}/editar`)}
        />
      )}

      {viajeACancelar && (
        <CancelarViajeModal
          viaje={viajeACancelar}
          onClose={() => setViajeACancelar(null)}
          onCancelado={handleCancelado}
        />
      )}

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={cerrarToast} />}
    </section>
  )
}
