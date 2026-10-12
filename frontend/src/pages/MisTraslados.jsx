// US19 (cliente): viajes publicados por los comisionistas y seguimiento de mis solicitudes.
// Desde acá se abre el formulario para sumarse como pasajero o enviar una encomienda.
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo, formatoFecha, Modal, Toast } from '../components/ui.jsx'

const fechaLocal = (fecha) => formatoFecha(`${fecha}T12:00:00`)
const hora = (h) => (h ? h.slice(0, 5) : '-')

const ESTADOS_SOLICITUD = {
  pendiente: { texto: 'Pendiente', clase: 'ambar' },
  aceptada: { texto: 'Aceptada', clase: 'verde' },
  rechazada: { texto: 'Rechazada', clase: 'rojo' },
  cancelada: { texto: 'Cancelada', clase: 'gris' },
}

export function BadgeSolicitud({ estado }) {
  const e = ESTADOS_SOLICITUD[estado] ?? { texto: estado, clase: 'gris' }
  return <span className={`badge punto ${e.clase}`}>{e.texto}</span>
}

export function TipoSolicitud({ solicitud }) {
  return solicitud.tipo === 'pasajero'
    ? <span>Pasajero{solicitud.cantidad_pasajeros > 1 ? `s (${solicitud.cantidad_pasajeros})` : ''}</span>
    : <span>Encomienda</span>
}

const FILTROS_VACIOS = { origen: '', destino: '', fecha: '' }
const FILTROS_SOLICITUDES_VACIOS = { estado: '', tipo: '' }

export default function MisTraslados() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  // Dos pestañas: "viajes" (disponibles) y "solicitudes" (las mías). Cada una tiene sus propios filtros.
  const [pestana, setPestana] = useState(ubicacion.state?.pestana === 'solicitudes' ? 'solicitudes' : 'viajes')
  const [filtrosSol, setFiltrosSol] = useState(FILTROS_SOLICITUDES_VACIOS)
  const [solicitudes, setSolicitudes] = useState([])
  const [viajes, setViajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)
  const [aCancelar, setACancelar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState('')
  const [toast, setToast] = useState(null)
  const cerrarToast = useCallback(() => setToast(null), [])

  const cargar = useCallback(async (f) => {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(f).forEach(([clave, valor]) => { if (valor) params.set(clave, valor) })
      const query = params.toString() ? `?${params.toString()}` : ''
      const [mias, disponibles] = await Promise.all([
        api.get('/solicitudes/mias'),
        api.get(`/solicitudes/viajes-disponibles${query}`),
      ])
      setSolicitudes(mias)
      setViajes(disponibles)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los viajes.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(filtrosAplicados) }, [cargar, filtrosAplicados])

  const hayFiltros = Object.values(filtrosAplicados).some(Boolean)
  const hayFiltrosSol = Object.values(filtrosSol).some(Boolean)
  const solicitudesVisibles = solicitudes.filter((s) => (!filtrosSol.estado || s.estado === filtrosSol.estado) && (!filtrosSol.tipo || s.tipo === filtrosSol.tipo))
  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value })

  async function confirmarCancelacion() {
    if (!aCancelar || procesando) return
    setProcesando(true)
    setErrorCancelacion('')
    try {
      await api.patch(`/solicitudes/${aCancelar.id}/cancelar`, {})
      const eraPendiente = aCancelar.estado === 'pendiente'
      setACancelar(null)
      setToast(eraPendiente
        ? { titulo: 'Solicitud retirada', texto: 'El comisionista ya no la ve entre las pendientes.' }
        : { titulo: 'Solicitud cancelada', texto: 'Tu lugar quedó liberado.' })
      await cargar(filtrosAplicados)
    } catch (err) {
      setErrorCancelacion(err.message || 'No se pudo cancelar la solicitud.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section className="mis-traslados">
      <div className="barra-pagina">
        <div>
          <h2>Mis traslados</h2>
          <p>Elegí un viaje y pedí tu lugar como pasajero o enviá una encomienda. El comisionista responde tu solicitud.</p>
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Mis traslados">
        <button type="button" role="tab" aria-selected={pestana === 'viajes'} className={pestana === 'viajes' ? 'activo' : ''} onClick={() => setPestana('viajes')}>
          Viajes disponibles
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'solicitudes'} className={pestana === 'solicitudes' ? 'activo' : ''} onClick={() => setPestana('solicitudes')}>
          Mis solicitudes{solicitudes.length > 0 && <span className="pestana-contador">{solicitudes.length}</span>}
        </button>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los viajes">{error}</Alerta>}

      {pestana === 'viajes' ? (
        <>
      <form className="card filtros filtros-3" onSubmit={(e) => { e.preventDefault(); setFiltrosAplicados(filtros) }}>
        <Campo label="Origen" icono="pin"><input name="origen" value={filtros.origen} onChange={cambiarFiltro} placeholder="Ej: Córdoba" /></Campo>
        <Campo label="Destino" icono="pin"><input name="destino" value={filtros.destino} onChange={cambiarFiltro} placeholder="Ej: Villa María" /></Campo>
        <Campo label="Fecha" icono="calendar"><input type="date" name="fecha" value={filtros.fecha} onChange={cambiarFiltro} /></Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltros && <button type="button" className="btn" onClick={() => { setFiltros(FILTROS_VACIOS); setFiltrosAplicados(FILTROS_VACIOS) }}>Limpiar</button>}
        </div>
      </form>

      <div className="card">
        <div className="card-cabecera">
          <div>
            <h2>Viajes disponibles</h2>
            <p>Viajes programados por los comisionistas. Los cupos muestran los lugares ya confirmados sobre el total.</p>
          </div>
        </div>
        <div className="tabla-wrap">
          {cargando ? (
            <p className="vacio">Cargando viajes...</p>
          ) : viajes.length === 0 ? (
            <p className="vacio">{hayFiltros ? 'No hay viajes disponibles con esos filtros.' : 'No hay viajes programados en este momento.'}</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr><th>Recorrido</th><th>Fecha</th><th>Salida</th><th>Llegada</th><th>Comisionista</th><th>Cupos pasajeros</th><th></th></tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <tr key={v.viaje_id}>
                    <td className="col-recorrido">{v.origen}<span className="flecha">→</span>{v.destino}</td>
                    <td>{fechaLocal(v.fecha)}</td>
                    <td>{hora(v.hora_salida)}</td>
                    <td>{hora(v.hora_llegada)}</td>
                    <td>{`${v.comisionista_nombre} ${v.comisionista_apellido ?? ''}`.trim()}</td>
                    <td>
                      {v.ocupados} / {v.cupo_total}
                      {v.cupos_disponibles === 0 && <span className="badge punto rojo" style={{ marginLeft: 8 }}>Completo</span>}
                      {(v.mis_solicitudes ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginTop: 6 }}>
                          {(v.mis_solicitudes ?? []).map((s) => (
                            <span key={s.tipo} className={`badge punto ${s.estado === 'aceptada' ? 'verde' : s.estado === 'rechazada' ? 'rojo' : 'ambar'}`}>
                              {s.tipo === 'pasajero' ? 'Pasajero' : 'Encomienda'}: {s.estado === 'aceptada' ? 'aceptada' : s.estado === 'rechazada' ? 'rechazada' : 'pendiente'}
                            </span>
                        ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="acciones-fila">
                        
                        <button type="button" className="btn btn-chico btn-primario" disabled={(v.mis_solicitudes ?? []).length >= 2}
                          title={(v.mis_solicitudes ?? []).length >= 2 ? 'Ya solicitaste como pasajero y como encomienda' : undefined}
                          onClick={() => navegar(`/mis-traslados/solicitar/${v.viaje_id}`)}>
                          <Icon nombre="seat" tamano={13} /> Solicitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
        </>
      ) : (
        <>
      <div className="card filtros filtros-2">
        <Campo label="Estado">
          <select value={filtrosSol.estado} onChange={(e) => setFiltrosSol({ ...filtrosSol, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aceptada">Aceptadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          <Icon nombre="down" />
        </Campo>
        <Campo label="Tipo">
          <select value={filtrosSol.tipo} onChange={(e) => setFiltrosSol({ ...filtrosSol, tipo: e.target.value })}>
            <option value="">Pasajeros y encomiendas</option>
            <option value="pasajero">Pasajeros</option>
            <option value="encomienda">Encomiendas</option>
          </select>
          <Icon nombre="down" />
        </Campo>
        {hayFiltrosSol && <div className="acciones"><button type="button" className="btn" onClick={() => setFiltrosSol(FILTROS_SOLICITUDES_VACIOS)}>Limpiar</button></div>}
      </div>

      <div className="card">
        <div className="card-cabecera">
          <div>
            <h2>Mis solicitudes</h2>
            <p>Seguí el estado de lo que pediste y cancelá lo que ya no necesites antes de que el viaje inicie.</p>
          </div>
        </div>
        <div className="tabla-wrap">
          {cargando ? (
            <p className="vacio">Cargando tus solicitudes...</p>
          ) : solicitudes.length === 0 ? (
            <p className="vacio">Todavía no enviaste ninguna solicitud.</p>
          ) : solicitudesVisibles.length === 0 ? (
            <p className="vacio">No hay solicitudes con esos filtros.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr><th>Recorrido</th><th>Fecha</th><th>Salida</th><th>Tipo</th><th>Comisionista</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {solicitudesVisibles.map((s) => (
                  <tr key={s.id}>
                    <td className="col-recorrido">{s.origen}<span className="flecha">→</span>{s.destino}</td>
                    <td>{fechaLocal(s.fecha)}</td>
                    <td>{hora(s.hora_salida)}</td>
                    <td><TipoSolicitud solicitud={s} /></td>
                    <td>{`${s.comisionista_nombre ?? ''} ${s.comisionista_apellido ?? ''}`.trim() || '-'}</td>
                    <td>
                      <BadgeSolicitud estado={s.estado} />
                      {s.estado === 'rechazada' && s.motivo_rechazo && <div className="campo-ayuda" style={{ marginTop: 6, maxWidth: 260 }}>Motivo: {s.motivo_rechazo}</div>}
                      {s.estado_viaje === 'cancelado' && s.estado !== 'cancelada' && <span className="badge punto rojo" style={{ marginLeft: 8 }}>Viaje cancelado</span>}
                    </td>
                    <td>
                      {s.puede_cancelar && (
                        <div className="acciones-fila">
                          <button type="button" className="btn btn-chico btn-peligro" onClick={() => { setACancelar(s); setErrorCancelacion('') }}>
                            <Icon nombre="x" tamano={13} /> {s.estado === 'pendiente' ? 'Retirar' : 'Cancelar'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
        </>
      )}

      {aCancelar && (
        <Modal onClose={() => { if (!procesando) setACancelar(null) }}>
          <span className="modal-icono"><Icon nombre="alert" tamano={22} /></span>
          <h2>{aCancelar.estado === 'pendiente' ? '¿Retirar tu solicitud?' : '¿Cancelar tu solicitud?'}</h2>
          <p>
            {aCancelar.origen} → {aCancelar.destino} · {fechaLocal(aCancelar.fecha)}.{' '}
            {aCancelar.estado === 'pendiente' ? 'El comisionista ya no la va a ver entre las pendientes.' : 'Los lugares quedarán disponibles para otros clientes.'}
          </p>
          {errorCancelacion && <div style={{ marginTop: 16 }}><Alerta tipo="error" titulo="No se pudo completar la acción">{errorCancelacion}</Alerta></div>}
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={() => setACancelar(null)} disabled={procesando}>Volver</button>
            <button type="button" className="btn btn-peligro" onClick={confirmarCancelacion} disabled={procesando}>{procesando ? 'Procesando...' : 'Confirmar'}</button>
          </div>
        </Modal>
      )}

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={cerrarToast} />}
    </section>
  )
}
