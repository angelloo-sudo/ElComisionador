// Epica 2: Gestion de Viajes - US10 (registrar), US12 (consultar) y US16 (filtrar).
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'
import ViajeDetalleModal from '../components/viajes/ViajeDetalleModal.jsx'
import CancelarViajeModal from '../components/viajes/CancelarViajeModal.jsx'
import EstadoViajeModal from '../components/viajes/EstadoViajeModal.jsx'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, Toast, BadgeEstado, ESTADOS_VIAJE, formatoFecha, textoRepeticion } from '../components/ui.jsx'
import { codigoViaje } from './ViajeNuevo.jsx'
import { estadoVisibleViaje, hoyEnCordoba, puedeIniciarViaje } from '../utils/estadoViaje.js'
import { formatoDuracion } from '../utils/tarifa.js'

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
  // US20 / US21: { accion: 'iniciar' | 'finalizar', viaje } mientras se pide la confirmacion.
  const [cambioEstado, setCambioEstado] = useState(null)
  const [toast, setToast] = useState(() => ubicacion.state?.aviso ?? null)
  // US18: aviso visual para el comisionista cuando el viaje modificado tiene clientes asociados.
  const [alertaClientes, setAlertaClientes] = useState(() => ubicacion.state?.alertaClientes ?? null)
  const cerrarToast = useCallback(() => setToast(null), [])
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)
  const [ahora, setAhora] = useState(() => new Date())
  const [pestana, setPestana] = useState('proximos') // 'proximos' | 'historial'

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

  useEffect(() => {
    let dia = hoyEnCordoba()
    const intervalo = setInterval(() => {
      const actual = new Date()
      setAhora(actual)
      const diaActual = hoyEnCordoba(actual)
      if (diaActual !== dia) {
        dia = diaActual
        cargarViajes(filtrosAplicados)
      }
    }, 60_000)
    return () => clearInterval(intervalo)
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

  // US20 / US21: el backend ya cambio el estado; se recarga la lista y se avisa.
  function handleEstadoCambiado() {
    const { accion, viaje } = cambioEstado
    setCambioEstado(null)
    setViajeDetalleId(null)
    cargarViajes(filtrosAplicados)
    setToast(accion === 'iniciar'
      ? { titulo: 'Viaje iniciado', texto: `El viaje ${codigoViaje(viaje.id)} pasó a estado En curso.` }
      : { titulo: 'Viaje finalizado', texto: `El viaje ${codigoViaje(viaje.id)} pasó a estado Finalizado.` })
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

  // Próximos: programados desde hoy en adelante y los que están en curso. Historial: el resto
  // (ya pasaron, finalizados o cancelados), con lo más reciente arriba.
  const hoy = hoyEnCordoba(ahora)
  const esProximo = (v) => v.estado === 'en_curso' || (v.estado === 'programado' && String(v.fecha).slice(0, 10) >= hoy)
  const orden = (a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.hora_salida ?? '').localeCompare(String(a.hora_salida ?? '')) || b.id - a.id
  const proximos = viajes.filter(esProximo).sort((a, b) => orden(b, a)) // el más cercano a hoy primero
  const historial = viajes.filter((v) => !esProximo(v)).sort(orden)
  const visibles = pestana === 'proximos' ? proximos : historial

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Mis viajes</h2>
          <p>Consultá y filtrá tus viajes. Los que ya pasaron están en la pestaña Historial.</p>
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

      <div className="pestanas" role="tablist" aria-label="Mis viajes">
        <button type="button" role="tab" aria-selected={pestana === 'proximos'} className={pestana === 'proximos' ? 'activo' : ''} onClick={() => setPestana('proximos')}>
          Próximos <span className="pestana-contador">{proximos.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'historial'} className={pestana === 'historial' ? 'activo' : ''} onClick={() => setPestana('historial')}>
          Historial <span className="pestana-contador">{historial.length}</span>
        </button>
      </div>

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando viajes...</p>
        ) : visibles.length === 0 ? (
          <p className="vacio">
            {hayFiltrosActivos
              ? 'No se encontraron viajes con esos filtros.'
              : pestana === 'proximos'
                ? (historial.length > 0 ? 'No tenés viajes próximos. Los anteriores están en Historial.' : 'Todavía no tenés viajes cargados.')
                : 'Todavía no tenés viajes en el historial.'}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Recorrido</th>
                <th>Fecha</th>
                <th>Salida</th>
                <th>Duración</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((viaje) => (
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
                  <td>{formatoDuracion(viaje.duracion_min)}</td>
                  <td>{viaje.ocupados ?? 0} / {viaje.cupo_total ?? '-'}</td>
                  <td><BadgeEstado estado={viaje.estado} fecha={viaje.fecha} ahora={ahora} /></td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="btn btn-chico" onClick={() => setViajeDetalleId(viaje.id)}>Ver detalle</button>
                      {puedeIniciarViaje(viaje, ahora) && (
                        <button type="button" className="btn btn-chico btn-primario" onClick={() => setCambioEstado({ accion: 'iniciar', viaje })}>
                          Iniciar
                        </button>
                      )}
                      {viaje.estado === 'en_curso' && (
                        <button type="button" className="btn btn-chico btn-primario" onClick={() => setCambioEstado({ accion: 'finalizar', viaje })}>
                          Finalizar
                        </button>
                      )}
                      {estadoVisibleViaje(viaje.estado, viaje.fecha, ahora) === 'programado' && (
                        <button type="button" className="btn btn-chico" onClick={() => navegar(`/viajes/${viaje.id}/editar`)}>
                          <Icon nombre="pencil" tamano={13} /> Modificar
                        </button>
                      )}
                      {estadoVisibleViaje(viaje.estado, viaje.fecha, ahora) === 'programado' && (
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
          onIniciar={(viaje) => setCambioEstado({ accion: 'iniciar', viaje })}
          onFinalizar={(viaje) => setCambioEstado({ accion: 'finalizar', viaje })}
          ahora={ahora}
        />
      )}

      {viajeACancelar && (
        <CancelarViajeModal
          viaje={viajeACancelar}
          onClose={() => setViajeACancelar(null)}
          onCancelado={handleCancelado}
        />
      )}

      {cambioEstado && (
        <EstadoViajeModal
          accion={cambioEstado.accion}
          viaje={cambioEstado.viaje}
          onClose={() => setCambioEstado(null)}
          onConfirmado={handleEstadoCambiado}
        />
      )}

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={cerrarToast} />}
    </section>
  )
}
