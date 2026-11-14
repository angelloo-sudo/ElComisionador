// US19 (cliente): viajes publicados por los comisionistas y seguimiento de mis solicitudes.
// Desde acá se abre el formulario para sumarse como pasajero o enviar una encomienda.
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo, formatoFecha, Modal, Toast, Mascota } from '../components/ui.jsx'
import { formatoDuracion, formatoPesos } from '../utils/tarifa.js'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'

const fechaLocal = (fecha) => formatoFecha(`${fecha}T12:00:00`)
const hora = (h) => (h ? h.slice(0, 5) : '-')

// Precio de una persona en ese viaje (lo calcula el sistema), o "A convenir" si no hay tarifa.
function precioPorPasajero(v) {
  const monto = v.precio_pasajero == null ? null : Number(v.precio_pasajero)
  if (v.requiere_calculo_tramo) return <span className="campo-ayuda">Se calcula para este tramo</span>
  return monto == null ? <span className="campo-ayuda">A convenir</span> : formatoPesos(monto)
}

function normalizarLocalidad(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim()
}

const aMinutos = (h) => Number(String(h).slice(0, 2)) * 60 + Number(String(h).slice(3, 5))

// Todas las combinaciones posibles de un viaje entre origen, paradas y destino, respetando el
// orden del recorrido: A→B, A→C, B→C... Cada una es una opción para solicitar.
export function combinacionesDeViaje(viaje) {
  const puntos = [
    { localidad: viaje.origen, hora: viaje.hora_salida },
    ...(viaje.paradas ?? []).map((p) => ({ localidad: p.localidad, hora: p.hora_estimada })),
    { localidad: viaje.destino, hora: viaje.hora_llegada },
  ]
  const opciones = []
  for (let i = 0; i < puntos.length - 1; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const completo = i === 0 && j === puntos.length - 1
      const { hora: horaDesde } = puntos[i]
      const { hora: horaHasta } = puntos[j]
      opciones.push({
        ...viaje,
        opcion_id: `${viaje.viaje_id}-${i}-${j}`,
        desde: puntos[i].localidad,
        hasta: puntos[j].localidad,
        hora_desde: horaDesde,
        duracion_tramo: completo || !horaDesde || !horaHasta ? viaje.duracion_min : (aMinutos(horaHasta) - aMinutos(horaDesde) + 1440) % 1440,
        completo,
      })
    }
  }
  return opciones
}

const ESTADOS_SOLICITUD = {
  pendiente: { texto: 'Pendiente', clase: 'ambar' },
  aceptada: { texto: 'Aceptada', clase: 'verde' },
  rechazada: { texto: 'Rechazada', clase: 'rojo' },
  cancelada: { texto: 'Cancelada', clase: 'gris' },
}

const ESTADOS_PASAJERO_CLIENTE = {
  a_bordo: { texto: 'A bordo', clase: 'verde' },
  en_destino: { texto: 'En destino', clase: 'verde' },
  ausente: { texto: 'Ausente', clase: 'ambar' },
  cancelado_comisionista: { texto: 'Cancelada por el comisionista', clase: 'gris' },
}

export function BadgeSolicitud({ estado, retirada = false, entregada = false, estadoPasajero = null, estadoViaje = null }) {
  // Rechazada o cancelada se muestran así aunque después se cancele el viaje; si no, un viaje
  // cancelado se muestra solo como "Viaje cancelado".
  if (estadoViaje === 'cancelado' && !['rechazada', 'cancelada'].includes(estado)) return <span className="badge punto rojo">Viaje cancelado</span>
  // Una encomienda aceptada que el comisionista ya retiro se muestra como "Retirada".
  const e = estado === 'aceptada' && ESTADOS_PASAJERO_CLIENTE[estadoPasajero] ? ESTADOS_PASAJERO_CLIENTE[estadoPasajero] : entregada && estado === 'aceptada' ? { texto: 'Entregada', clase: 'verde' } : retirada && estado === 'aceptada' ? { texto: 'Retirada', clase: 'verde' } : ESTADOS_SOLICITUD[estado] ?? { texto: estado, clase: 'gris' }
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
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()
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

  // Cada viaje se muestra como todas sus combinaciones de subida y bajada; si se eligió origen o
  // destino, solo las que empiezan o terminan ahí.
  const opciones = viajes.flatMap(combinacionesDeViaje).filter((o) =>
    (!filtrosAplicados.origen || normalizarLocalidad(o.desde) === normalizarLocalidad(filtrosAplicados.origen))
    && (!filtrosAplicados.destino || normalizarLocalidad(o.hasta) === normalizarLocalidad(filtrosAplicados.destino)))

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
          <h2>Viajes</h2>
          <p>Elegí un viaje y pedí tu lugar como pasajero o enviá una encomienda. El comisionista responde tu solicitud.</p>
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Viajes y solicitudes">
        <button type="button" role="tab" aria-selected={pestana === 'viajes'} className={pestana === 'viajes' ? 'activo' : ''} onClick={() => setPestana('viajes')}>
          Viajes
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'solicitudes'} className={pestana === 'solicitudes' ? 'activo' : ''} onClick={() => setPestana('solicitudes')}>
          Solicitudes{solicitudes.length > 0 && <span className="pestana-contador">{solicitudes.length}</span>}
        </button>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los viajes">{error}</Alerta>}

      {pestana === 'viajes' ? (
        <>
      <form className="card filtros filtros-3" onSubmit={(e) => { e.preventDefault(); setFiltrosAplicados(filtros) }}>
        <LocalidadSelect requerido={false} label="Origen" placeholder="Todas" value={filtros.origen} onChange={(origen) => setFiltros((f) => ({ ...f, origen }))} localidades={localidades} deshabilitado={cargandoLocalidades} />
        <LocalidadSelect requerido={false} label="Destino" placeholder="Todas" value={filtros.destino} onChange={(destino) => setFiltros((f) => ({ ...f, destino }))} localidades={localidades} deshabilitado={cargandoLocalidades} />
        <Campo label="Fecha" icono="calendar"><input type="date" name="fecha" value={filtros.fecha} onChange={cambiarFiltro} /></Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltros && <button type="button" className="btn" onClick={() => { setFiltros(FILTROS_VACIOS); setFiltrosAplicados(FILTROS_VACIOS) }}>Limpiar</button>}
        </div>
      </form>

      {hayFiltros ? <div className="card">
        <div className="card-cabecera">
          <div>
            <h2>Viajes disponibles</h2>
            <p>Cada fila es una forma de hacer el viaje: del origen, de una parada o hasta una parada. Los cupos muestran los lugares ya confirmados sobre el total.</p>
          </div>
        </div>
        <div className="tabla-wrap">
          {cargando ? (
            <p className="vacio">Cargando viajes...</p>
          ) : opciones.length === 0 ? (
            <p className="vacio">{hayFiltros ? 'No hay viajes disponibles con esos filtros.' : 'No hay viajes programados en este momento.'}</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr><th>Recorrido</th><th>Fecha</th><th>Salida</th><th>Duración</th><th>Comisionista</th><th>Precio por pasajero</th><th>Cupos pasajeros</th><th></th></tr>
              </thead>
              <tbody>
                {opciones.map((v) => (
                  <tr key={v.opcion_id}>
                    <td className="col-recorrido">{v.desde}<span className="flecha">→</span>{v.hasta}
                      {!v.completo && <small className="campo-ayuda">Viaje completo: {v.origen} → {v.destino}</small>}
                    </td>
                    <td>{fechaLocal(v.fecha)}</td>
                    <td>{hora(v.hora_desde)}</td>
                    <td>{formatoDuracion(v.duracion_tramo)}</td>
                    <td>{`${v.comisionista_nombre} ${v.comisionista_apellido ?? ''}`.trim()}</td>
                    <td>{v.completo ? precioPorPasajero(v) : <span className="campo-ayuda">Se calcula al solicitar</span>}</td>
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
                          onClick={() => navegar(`/mis-traslados/solicitar/${v.viaje_id}?desde=${encodeURIComponent(v.desde)}&hasta=${encodeURIComponent(v.hasta)}`)}>
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
      </div> : <div className="card viajes-indicacion"><Mascota ancho={76} /><p>Realizá una búsqueda para ver resultados.</p></div>}
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
            <h2>Solicitudes</h2>
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
                <tr><th>Recorrido</th><th>Fecha</th><th>Salida</th><th>Tipo</th><th>Comisionista</th><th>Monto</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {solicitudesVisibles.map((s) => (
                  <tr key={s.id}>
                    <td className="col-recorrido">
                      {s.origen_localidad ?? s.origen}<span className="flecha">→</span>{s.destino_localidad ?? s.destino}
                      {((s.origen_localidad ?? s.origen) !== s.origen || (s.destino_localidad ?? s.destino) !== s.destino) && (
                        <div className="campo-ayuda">Viaje completo: {s.origen} → {s.destino}</div>
                      )}
                    </td>
                    <td>{fechaLocal(s.fecha)}</td>
                    <td>{hora(s.hora_salida)}</td>
                    <td><TipoSolicitud solicitud={s} /></td>
                    <td>{`${s.comisionista_nombre ?? ''} ${s.comisionista_apellido ?? ''}`.trim() || '-'}</td>
                    <td>{s.monto == null ? <span className="campo-ayuda">A convenir</span> : formatoPesos(s.monto)}</td>
                    <td>
                      <BadgeSolicitud estado={s.estado} retirada={Boolean(s.retirada_en)} entregada={Boolean(s.entregada_en)} estadoPasajero={s.estado_pasajero} estadoViaje={s.estado_viaje} />
                      {s.estado === 'rechazada' && s.motivo_rechazo && <div className="campo-ayuda" style={{ marginTop: 6, maxWidth: 260 }}>Motivo: {s.motivo_rechazo}</div>}
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
