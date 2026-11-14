import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta, Modal, formatoFecha } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'

const SECCIONES = {
  viajes: { titulo: 'Historial de viajes', pestana: 'Viajes', icono: 'logo', descripcion: 'Consultá tus viajes y sus itinerarios anteriores.' },
  encomiendas: { titulo: 'Historial de encomiendas', pestana: 'Encomiendas', icono: 'package', descripcion: 'Consultá envíos asociados a tus viajes y sus estados registrados.' },
  pasajeros: { titulo: 'Historial de pasajeros', pestana: 'Pasajeros', icono: 'users', descripcion: 'Cada fila representa una reserva individual, incluso si el pasajero viajó varias veces.' },
}
const FILTROS_VACIOS = {}

const hora = (v) => v ? String(v).slice(0, 5) : '—'
const nombre = (x) => [x?.nombre, x?.apellido].filter(Boolean).join(' ') || 'Sin nombre registrado'
const textoEstado = (v) => String(v ?? 'Sin estado').replaceAll('_', ' ')
const claseEstado = (valor) => {
  const estado = String(valor ?? '').toLowerCase()
  if (['finalizado', 'entregado', 'en_destino', 'aceptada'].some((x) => estado.includes(x))) return 'verde'
  if (['cancelado', 'cancelada', 'rechazada', 'ausente'].some((x) => estado.includes(x))) return 'rojo'
  if (['en_curso', 'retirado', 'a_bordo', 'vencido'].some((x) => estado.includes(x))) return 'ambar'
  if (['programado', 'pendiente'].some((x) => estado.includes(x))) return 'azul'
  return 'gris'
}
const qs = (f) => {
  const p = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
  return p.size ? `?${p}` : ''
}

function CampoFiltro({ label, ...props }) {
  return <label className="campo"><span>{label}</span><div className="input-wrap"><input {...props} /></div></label>
}

function Filtros({ seccion, filtros, setFiltros, aplicar, limpiar, clientes }) {
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()
  const set = (k) => (e) => setFiltros((actual) => ({ ...actual, [k]: e.target.value }))
  const setValor = (k) => (valor) => setFiltros((actual) => ({ ...actual, [k]: valor }))
  const particular = seccion === 'encomiendas' ? ' particular' : ''
  return <form className="card filtros historial-filtros" onSubmit={(e) => { e.preventDefault(); aplicar() }}>
    <CampoFiltro label="Desde" type="date" value={filtros.desde ?? ''} onChange={set('desde')} />
    <CampoFiltro label="Hasta" type="date" value={filtros.hasta ?? ''} onChange={set('hasta')} />
    <CampoFiltro label={seccion === 'pasajeros' ? 'Cliente o pasajero' : 'Cliente'} placeholder="Nombre o apellido" list="historial-clientes" autoComplete="off" value={filtros.cliente ?? ''} onChange={set('cliente')} />
    <datalist id="historial-clientes">{clientes.map((c) => <option key={c.id} value={nombre(c)} />)}</datalist>
    <LocalidadSelect requerido={false} label={`Origen${particular}`} placeholder="Todas" value={filtros.origen ?? ''} onChange={setValor('origen')} localidades={localidades} deshabilitado={cargandoLocalidades} />
    <LocalidadSelect requerido={false} label={`Destino${particular}`} placeholder="Todas" value={filtros.destino ?? ''} onChange={setValor('destino')} localidades={localidades} deshabilitado={cargandoLocalidades} />
    {seccion === 'encomiendas' && <><label className="campo"><span>Estado</span><div className="input-wrap"><select value={filtros.estado ?? ''} onChange={set('estado')}><option value="">Todos</option>{['pendiente', 'aceptada', 'rechazada', 'cancelada', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'].map((s) => <option key={s} value={s}>{textoEstado(s)}</option>)}</select><Icon nombre="down" /></div></label><small className="historial-nota-filtro">Las encomiendas legadas no tienen localidades propias registradas; los filtros por localidad se aplican a las solicitudes que sí las almacenan.</small></>}
    <div className="acciones"><button className="btn btn-primario" type="submit"><Icon nombre="search" tamano={16} /> Aplicar</button><button className="btn" type="button" onClick={limpiar}>Limpiar</button></div>
  </form>
}

function Item({ seccion, item, onDetalle }) {
  let titulo, subtitulo, fecha, estado
  if (seccion === 'viajes') { titulo = `${item.origen} → ${item.destino}`; subtitulo = `Salida ${hora(item.hora_salida)} · Llegada ${hora(item.hora_llegada)}${item.hora_llegada && item.hora_salida && String(item.hora_llegada) < String(item.hora_salida) ? ' (+1 día)' : ''}`; fecha = item.fecha; estado = item.estado }
  if (seccion === 'encomiendas') { titulo = `${item.origen_registro === 'solicitud' ? 'Solicitud de encomienda' : 'Encomienda'} #${item.id} · ${item.cliente || 'Cliente no asociado'}`; subtitulo = `${item.origen_localidad || 'Origen particular no registrado'} → ${item.destino_localidad || 'Destino particular no registrado'} · Viaje #${item.viaje_id}`; fecha = item.fecha; estado = item.estado }
  if (seccion === 'pasajeros') { titulo = `${nombre(item)} · Reserva #${item.solicitud_id}`; subtitulo = `${item.origen_localidad} → ${item.destino_localidad} · Viaje #${item.viaje_id}`; fecha = item.fecha; estado = item.estado_pasajero ? `${textoEstado(item.estado_reserva)} · ${textoEstado(item.estado_pasajero)}` : item.estado_reserva }
  return <article className="card historial-item"><div><strong>{titulo}</strong><p>{subtitulo}</p><small>{formatoFecha(fecha)}</small></div><div className="historial-item-acciones"><span className={`badge punto ${claseEstado(estado)}`}>{textoEstado(estado)}</span><button className="btn" type="button" onClick={() => onDetalle(item)}>Ver detalle</button></div></article>
}

function Detalle({ seccion, item }) {
  const [data, setData] = useState(item)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  useEffect(() => {
    let vivo = true
    const fetchDetalle = async () => {
      const path = seccion === 'viajes' ? `viajes/${item.id}` : seccion === 'encomiendas' ? `encomiendas/${item.origen_registro}/${item.id}` : `pasajeros/${item.solicitud_id}`
      setCargando(true)
      try { const r = await api.get(`/historial/${path}`); if (vivo) setData(r.viaje ?? r.encomienda ?? r.pasajero) }
      catch (e) { if (vivo) setError(e.message) }
      finally { if (vivo) setCargando(false) }
    }
    fetchDetalle()
    return () => { vivo = false }
  }, [seccion, item])

  const filas = useMemo(() => {
    if (seccion === 'viajes') return [['Viaje', `${data.origen} → ${data.destino}`], ['Fecha', formatoFecha(data.fecha)], ['Salida', hora(data.hora_salida)], ['Llegada', hora(data.hora_llegada)], ['Estado', textoEstado(data.estado)], ['Distancia', data.distancia_km ? `${data.distancia_km} km` : '—'], ['Duración', data.duracion_min ? `${data.duracion_min} min` : '—']]
    if (seccion === 'encomiendas') return [['Identificador', `${data.origen_registro === 'solicitud' ? 'Solicitud' : 'Encomienda'} #${data.id}`], ['Cliente', data.cliente || 'No asociado'], ['Remitente', data.remitente_nombre || '—'], ['Teléfono del remitente', data.remitente_telefono || '—'], ['Dirección de retiro', data.direccion_retiro || '—'], ['Destinatario', data.destinatario_nombre || '—'], ['Teléfono del destinatario', data.destinatario_telefono || '—'], ['Dirección de entrega', data.destinatario_direccion || '—'], ['Estado', textoEstado(data.estado)], ['Fecha de solicitud', data.fecha_solicitud ? new Date(data.fecha_solicitud).toLocaleString('es-AR') : formatoFecha(data.fecha)], ['Viaje principal', `#${data.viaje_id}: ${data.viaje_origen} → ${data.viaje_destino} (${formatoFecha(data.fecha_viaje)})`], ['Origen particular', data.origen_localidad || 'No registrado'], ['Destino particular', data.destino_localidad || 'No registrado']]
    return [['Reserva', `#${data.solicitud_id}`], ['Pasajero', nombre(data)], ['Viaje', `#${data.viaje_id}: ${data.viaje_origen} → ${data.viaje_destino}`], ['Trayecto reservado', `${data.origen_localidad || data.viaje_origen} → ${data.destino_localidad || data.viaje_destino}`], ['Fecha', formatoFecha(data.fecha)], ['Salida', hora(data.hora_salida)], ['Llegada', hora(data.hora_llegada)], ['Estado de reserva', textoEstado(data.estado_reserva)], ['Estado operativo', textoEstado(data.estado_pasajero)], ['Cantidad de pasajeros', data.cantidad_pasajeros ?? '—'], ['Equipaje', data.lleva_equipaje == null ? '—' : data.lleva_equipaje ? data.equipaje_detalle || 'Sí' : 'No']]
  }, [data, seccion])
  return <>{error && <Alerta>{error}</Alerta>}{cargando && <p role="status">Cargando detalle…</p>}<dl className="historial-detalle">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}</dl>
    {seccion === 'viajes' && data.paradas?.length > 0 && <section className="historial-detalle-seccion"><h3>Paradas intermedias</h3><ol>{data.paradas.map((p) => <li key={p.id ?? p.orden}>{p.localidad} · {hora(p.hora_estimada)}</li>)}</ol></section>}
    {seccion === 'encomiendas' && <section className="historial-detalle-seccion"><h3>Historial de estados registrado</h3>{data.historial_disponible === false ? <p>Esta solicitud no tiene historial de cambios persistido.</p> : data.historial?.length ? <ol>{data.historial.map((h) => <li key={h.id}>{textoEstado(h.estado)} · {new Date(h.fecha_hora).toLocaleString('es-AR')}</li>)}</ol> : <p>No hay cambios históricos almacenados para esta encomienda.</p>}</section>}
    {seccion === 'pasajeros' && data.paradas?.length > 0 && <section className="historial-detalle-seccion"><h3>Paradas del viaje</h3><ol>{data.paradas.map((p) => <li key={p.orden}>{p.localidad} · {hora(p.hora_estimada)}</li>)}</ol></section>}</>
}

export default function Historiales() {
  const { seccion = 'viajes' } = useParams()
  const config = SECCIONES[seccion] ?? SECCIONES.viajes
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS)
  const [registros, setRegistros] = useState([])
  const [clientes, setClientes] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorFiltro, setErrorFiltro] = useState('')

  useEffect(() => { setFiltros(FILTROS_VACIOS); setAplicados(FILTROS_VACIOS); setSeleccion(null) }, [seccion])
  // Nombres de los clientes de tus viajes, como sugerencias del filtro "Cliente".
  useEffect(() => {
    let vivo = true
    api.get('/historial/clientes').then((r) => { if (vivo) setClientes(r.clientes) }).catch(() => { /* el filtro funciona igual sin sugerencias */ })
    return () => { vivo = false }
  }, [])
  useEffect(() => {
    if (!SECCIONES[seccion]) return undefined
    let vivo = true
    const cargar = async () => {
      if (aplicados.desde && aplicados.hasta && aplicados.desde > aplicados.hasta) { setErrorFiltro('La fecha de inicio no puede ser posterior a la fecha de fin'); setRegistros([]); setCargando(false); return }
      setErrorFiltro(''); setCargando(true); setError('')
      try {
        const r = await api.get(`/historial/${seccion}${qs(aplicados)}`)
        if (vivo) setRegistros(r.viajes ?? r.encomiendas ?? r.pasajeros ?? [])
      } catch (e) { if (vivo) { setError(e.message); setRegistros([]) } }
      finally { if (vivo) setCargando(false) }
    }
    cargar()
    return () => { vivo = false }
  }, [seccion, aplicados])

  const limpiar = () => { setFiltros(FILTROS_VACIOS); setAplicados(FILTROS_VACIOS) }
  const aplicar = () => setAplicados({ ...filtros, cliente: filtros.cliente?.trim() })
  if (!SECCIONES[seccion]) return <Navigate to="/historial/viajes" replace />
  return <div className="pagina-historial"><header className="barra-pagina"><div><h2>{config.titulo}</h2><p>{config.descripcion}</p></div></header>
    <nav className="pestanas" aria-label="Tipo de historial">
      {Object.entries(SECCIONES).map(([tipo, s]) => <NavLink key={tipo} to={`/historial/${tipo}`} aria-current={seccion === tipo ? 'page' : undefined} className={({ isActive }) => isActive ? 'activo' : ''}>
        <Icon nombre={s.icono} tamano={16} /> {s.pestana}
      </NavLink>)}
    </nav>
    {error && <Alerta>{error}</Alerta>}{errorFiltro && <Alerta>{errorFiltro}</Alerta>}
    <Filtros seccion={seccion} filtros={filtros} setFiltros={setFiltros} aplicar={aplicar} limpiar={limpiar} clientes={clientes} />
    {cargando ? <div className="card historial-vacio" role="status">Cargando historial…</div> : <div className="historial-lista">{registros.map((item) => <Item key={`${item.origen_registro ?? seccion}:${item.id ?? item.solicitud_id}`} seccion={seccion} item={item} onDetalle={setSeleccion} />)}{!registros.length && <div className="card historial-vacio">No hay registros para los filtros seleccionados.</div>}</div>}
    {seleccion && <Modal ancho="extra" onClose={() => setSeleccion(null)}><div className="historial-modal-cabecera"><h2>{config.titulo}</h2><button type="button" className="btn" onClick={() => setSeleccion(null)}>Cerrar</button></div><Detalle seccion={seccion} item={seleccion} /></Modal>}
  </div>
}
