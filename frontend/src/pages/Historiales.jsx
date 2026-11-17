import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta, Modal, formatoFecha } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'

const FILTROS_VACIOS = { desde: '', hasta: '', origen: '', destino: '', estado: '', contenido: '' }
const hora = (valor) => valor ? String(valor).slice(0, 5) : '—'
const nombre = (valor) => [valor?.nombre, valor?.apellido].filter(Boolean).join(' ') || 'Sin nombre registrado'
const estadoTexto = (valor) => ({
  retirada: 'Retirada',
  entregada: 'Entregada',
})[valor] ?? String(valor ?? 'Sin estado').replaceAll('_', ' ')
const fechaHora = (valor) => valor ? new Date(valor).toLocaleString('es-AR') : '—'
const mostrar = (valor) => valor == null || valor === '' ? '—' : typeof valor === 'boolean' ? valor ? 'Sí' : 'No' : valor
const pluralizar = (cantidad, singular, plural) => Number(cantidad) === 1 ? singular : plural

function claseEstado(valor) {
  const estado = String(valor ?? '').toLowerCase()
  if (['finalizado', 'entregado', 'en_destino', 'aceptada'].some((x) => estado.includes(x))) return 'verde'
  if (['cancelado', 'cancelada', 'rechazada', 'ausente'].some((x) => estado.includes(x))) return 'rojo'
  if (['en_curso', 'retirado', 'a_bordo'].some((x) => estado.includes(x))) return 'ambar'
  if (['programado', 'pendiente'].some((x) => estado.includes(x))) return 'azul'
  return 'gris'
}

function qs(filtros) {
  const parametros = new URLSearchParams()
  Object.entries(filtros).forEach(([clave, valor]) => { if (valor) parametros.set(clave, valor) })
  return parametros.size ? `?${parametros}` : ''
}

function FiltrosViajes({ filtros, setFiltros, aplicar, limpiar }) {
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()
  const set = (clave) => (evento) => setFiltros((actual) => ({ ...actual, [clave]: evento.target.value }))
  const setLocalidad = (clave) => (valor) => setFiltros((actual) => ({ ...actual, [clave]: valor }))

  return <form className="card filtros historial-filtros" onSubmit={(evento) => { evento.preventDefault(); aplicar() }}>
    <label className="campo"><span>Desde</span><div className="input-wrap"><input type="date" value={filtros.desde} onChange={set('desde')} /></div></label>
    <label className="campo"><span>Hasta</span><div className="input-wrap"><input type="date" value={filtros.hasta} onChange={set('hasta')} /></div></label>
    <LocalidadSelect requerido={false} label="Origen" placeholder="Todos" value={filtros.origen} onChange={setLocalidad('origen')} localidades={localidades} deshabilitado={cargandoLocalidades} />
    <LocalidadSelect requerido={false} label="Destino" placeholder="Todos" value={filtros.destino} onChange={setLocalidad('destino')} localidades={localidades} deshabilitado={cargandoLocalidades} />
    <label className="campo"><span>Estado del viaje</span><div className="input-wrap"><select value={filtros.estado} onChange={set('estado')}>
      <option value="">Todos</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option>
    </select><Icon nombre="down" /></div></label>
    <label className="campo"><span>Contenido asociado</span><div className="input-wrap"><select value={filtros.contenido} onChange={set('contenido')}>
      <option value="">Todos los viajes</option><option value="encomiendas">Con encomiendas</option><option value="pasajeros">Con pasajeros</option><option value="ambos">Con ambos</option>
    </select><Icon nombre="down" /></div></label>
    <div className="acciones">
      <button className="btn btn-primario" type="submit"><Icon nombre="search" tamano={16} /> Aplicar</button>
      <button className="btn" type="button" onClick={limpiar}>Limpiar</button>
    </div>
  </form>
}

function Contador({ icono, cantidad, singular, plural, onClick }) {
  return <button type="button" className="historial-contador" onClick={onClick}>
    <Icon nombre={icono} tamano={16} /><strong>{cantidad}</strong> {pluralizar(cantidad, singular, plural)}
  </button>
}

function ViajeItem({ viaje, onDetalle }) {
  return <article className="card historial-viaje">
    <div className="historial-viaje-cabecera">
      <div>
        <small>Viaje #{viaje.id}</small>
        <h3>{viaje.origen} <span aria-hidden="true">→</span> {viaje.destino}</h3>
        <p>{formatoFecha(viaje.fecha)} · Salida {hora(viaje.hora_salida)} · Llegada {hora(viaje.hora_llegada)}</p>
      </div>
      <span className={`badge punto ${claseEstado(viaje.estado)}`}>{estadoTexto(viaje.estado)}</span>
    </div>
    <div className="historial-viaje-pie">
      <div className="historial-contadores">
        <Contador icono="package" cantidad={viaje.cantidad_encomiendas} singular="encomienda" plural="encomiendas" onClick={() => onDetalle(viaje)} />
        <Contador icono="users" cantidad={viaje.cantidad_pasajeros} singular="pasajero" plural="pasajeros" onClick={() => onDetalle(viaje)} />
      </div>
      <button className="btn" type="button" onClick={() => onDetalle(viaje)}>Ver viaje completo</button>
    </div>
  </article>
}

function CamposDetalle({ filas }) {
  return <dl className="historial-detalle">{filas.map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{mostrar(valor)}</dd></div>)}</dl>
}

function RegistroRelacionado({ titulo, resumen, estado, filas, historialEstados }) {
  const [abierto, setAbierto] = useState(false)
  return <article className="historial-relacion">
    <button className="historial-relacion-toggle" type="button" aria-expanded={abierto} onClick={() => setAbierto((actual) => !actual)}>
      <span><strong>{titulo}</strong><small>{resumen}</small></span>
      <span className={`badge punto ${claseEstado(estado)}`}>{estadoTexto(estado)}</span>
      <Icon nombre="down" tamano={16} />
    </button>
    {abierto && <div className="historial-relacion-detalle">
      <CamposDetalle filas={filas} />
      {historialEstados && <div className="historial-estados">
        <strong>Seguimiento de estados</strong>
        {historialEstados.length
          ? <ol>{historialEstados.map((evento) => <li key={evento.id}>{estadoTexto(evento.estado)} · {fechaHora(evento.fecha_hora)}</li>)}</ol>
          : <p>No hay eventos de estado registrados.</p>}
      </div>}
    </div>}
  </article>
}

function filasEncomienda(encomienda) {
  const medidas = [encomienda.ancho_cm, encomienda.largo_cm, encomienda.profundidad_cm]
    .every((medida) => medida != null)
    ? `${encomienda.ancho_cm} × ${encomienda.largo_cm} × ${encomienda.profundidad_cm} cm`
    : null
  return [
    ['Identificador', `${encomienda.origen_registro === 'solicitud' ? 'Solicitud' : 'Encomienda'} #${encomienda.id}`],
    ['Remitente', encomienda.remitente_nombre], ['Teléfono del remitente', encomienda.remitente_telefono],
    ['Dirección de retiro', encomienda.direccion_retiro], ['Destinatario', encomienda.destinatario_nombre],
    ['Teléfono del destinatario', encomienda.destinatario_telefono], ['Dirección de entrega', encomienda.destinatario_direccion],
    ['Descripción', encomienda.descripcion], ['Tipo de contenido', encomienda.tipo_contenido],
    ['Peso (kg)', encomienda.peso_kg], ['Tamaño', encomienda.tamano ?? encomienda.dimensiones ?? medidas],
    ['Frágil', encomienda.fragil], ['Registrada', fechaHora(encomienda.fecha_solicitud)],
    ['Estado', estadoTexto(encomienda.estado)], ['Estado de pago', encomienda.estado_pago],
    ['Forma de pago', encomienda.forma_pago], ['Retirada', fechaHora(encomienda.retirado_en)],
    ['Entregada', fechaHora(encomienda.entregada_en)], ['Origen particular', encomienda.origen_localidad],
    ['Destino particular', encomienda.destino_localidad],
  ]
}

function filasPasajero(pasajero, viaje) {
  return [
    ['Reserva', `#${pasajero.solicitud_id}`], ['Pasajero', nombre(pasajero)],
    ['Teléfono', pasajero.telefono], ['Fecha del viaje', formatoFecha(viaje.fecha)],
    ['Origen y destino', `${pasajero.origen_localidad || viaje.origen} → ${pasajero.destino_localidad || viaje.destino}`],
    ['Estado de reserva', estadoTexto(pasajero.estado_reserva)],
    ['Estado del traslado', estadoTexto(pasajero.estado_pasajero)],
    ['Cantidad en la reserva', pasajero.cantidad_pasajeros],
    ['Equipaje', pasajero.lleva_equipaje == null ? null : pasajero.lleva_equipaje ? pasajero.equipaje_detalle || 'Sí' : 'No'],
    ['Forma de pago', pasajero.forma_pago], ['Importe', pasajero.monto],
    ['Reserva creada', fechaHora(pasajero.creado_en)], ['Reserva resuelta', fechaHora(pasajero.resuelto_en)],
    ['Subió', fechaHora(pasajero.subio_en)], ['Llegó a destino', fechaHora(pasajero.llego_en)],
  ]
}

function DetalleViaje({ viajeInicial }) {
  const [viaje, setViaje] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    api.get(`/historial/viajes/${viajeInicial.id}`)
      .then(({ viaje: detalle }) => { if (vigente) setViaje(detalle) })
      .catch((e) => { if (vigente) setError(e.message || 'No se pudo cargar el detalle del viaje.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [viajeInicial.id])

  return <>
    {cargando && <p role="status">Cargando detalle del viaje…</p>}
    {error && <Alerta tipo="error" titulo="No se pudo cargar el viaje">{error}</Alerta>}
    {viaje && <>
      <section className="historial-detalle-seccion">
        <h3>A. Datos del viaje</h3>
        <CamposDetalle filas={[
          ['Origen y destino', `${viaje.origen} → ${viaje.destino}`], ['Fecha', formatoFecha(viaje.fecha)],
          ['Horario de salida', hora(viaje.hora_salida)], ['Horario de llegada', hora(viaje.hora_llegada)],
          ['Estado', estadoTexto(viaje.estado)], ['Distancia', viaje.distancia_km == null ? null : `${viaje.distancia_km} km`],
          ['Duración', viaje.duracion_min == null ? null : `${viaje.duracion_min} min`], ['Cupo', viaje.cupo_total],
          ['Iniciado', fechaHora(viaje.iniciado_en)], ['Finalizado', fechaHora(viaje.finalizado_en)],
          ['Repetición', viaje.repeticion_dias], ['Creado', fechaHora(viaje.creado_en)],
        ]} />
        {viaje.paradas?.length > 0 && <div className="historial-estados"><strong>Paradas intermedias</strong><ol>{viaje.paradas.map((parada) => <li key={parada.id}>{parada.localidad} · {hora(parada.hora_estimada)}</li>)}</ol></div>}
      </section>
      <section className="historial-detalle-seccion">
        <h3>B. Encomiendas asociadas ({viaje.encomiendas.length})</h3>
        {viaje.encomiendas.length
          ? <div className="historial-relacion-lista">{viaje.encomiendas.map((encomienda) => <RegistroRelacionado
            key={`${encomienda.origen_registro}:${encomienda.id}`}
            titulo={`${encomienda.origen_registro === 'solicitud' ? 'Solicitud' : 'Encomienda'} #${encomienda.id}`}
            resumen={`${encomienda.remitente_nombre || 'Remitente no registrado'} → ${encomienda.destinatario_nombre || 'Destinatario no registrado'}`}
            estado={encomienda.estado} filas={filasEncomienda(encomienda)} historialEstados={encomienda.historial}
          />)}</div>
          : <p className="campo-ayuda">Este viaje no tiene encomiendas asociadas.</p>}
      </section>
      <section className="historial-detalle-seccion">
        <h3>C. Pasajeros asociados ({viaje.pasajeros.length} reservas · {viaje.cantidad_pasajeros} pasajeros)</h3>
        {viaje.pasajeros.length
          ? <div className="historial-relacion-lista">{viaje.pasajeros.map((pasajero) => <RegistroRelacionado
            key={pasajero.solicitud_id}
            titulo={`${nombre(pasajero)} · Reserva #${pasajero.solicitud_id}`}
            resumen={`${pasajero.origen_localidad || viaje.origen} → ${pasajero.destino_localidad || viaje.destino} · ${pasajero.cantidad_pasajeros ?? 'Cantidad no registrada'} ${pluralizar(pasajero.cantidad_pasajeros, 'pasajero', 'pasajeros')}`}
            estado={pasajero.estado_pasajero || pasajero.estado_reserva}
            filas={filasPasajero(pasajero, viaje)}
          />)}</div>
          : <p className="campo-ayuda">Este viaje no tiene reservas de pasajeros asociadas.</p>}
      </section>
    </>}
  </>
}

export default function Historiales() {
  const { seccion = 'viajes' } = useParams()
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS)
  const [viajes, setViajes] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorFiltro, setErrorFiltro] = useState('')

  useEffect(() => {
    setFiltros(FILTROS_VACIOS)
    setAplicados(FILTROS_VACIOS)
    setSeleccion(null)
  }, [seccion])

  useEffect(() => {
    if (seccion !== 'viajes') return undefined
    let vigente = true
    const cargar = async () => {
      if (aplicados.desde && aplicados.hasta && aplicados.desde > aplicados.hasta) {
        setErrorFiltro('La fecha de inicio no puede ser posterior a la fecha de fin')
        setViajes([])
        setCargando(false)
        return
      }
      setErrorFiltro('')
      setCargando(true)
      setError('')
      try {
        const respuesta = await api.get(`/historial/viajes${qs(aplicados)}`)
        if (vigente) setViajes(respuesta.viajes ?? [])
      } catch (e) {
        if (vigente) { setError(e.message || 'No se pudieron cargar los viajes.'); setViajes([]) }
      } finally {
        if (vigente) setCargando(false)
      }
    }
    cargar()
    return () => { vigente = false }
  }, [seccion, aplicados])

  if (seccion !== 'viajes') return <Navigate to="/historial/viajes" replace />
  const limpiar = () => { setFiltros(FILTROS_VACIOS); setAplicados(FILTROS_VACIOS) }

  return <div className="pagina-historial">
    <header className="barra-pagina"><div><h2>Historial de viajes</h2><p>Consultá los viajes finalizados y cancelados, con sus encomiendas y pasajeros asociados.</p></div></header>
    <FiltrosViajes filtros={filtros} setFiltros={setFiltros} aplicar={() => setAplicados({ ...filtros })} limpiar={limpiar} />
    {error && <Alerta tipo="error" titulo="No se pudo cargar el historial">{error}</Alerta>}
    {errorFiltro && <Alerta tipo="error">{errorFiltro}</Alerta>}
    {cargando
      ? <div className="card historial-vacio" role="status">Cargando historial…</div>
      : <div className="historial-lista">
        {viajes.map((viaje) => <ViajeItem key={viaje.id} viaje={viaje} onDetalle={setSeleccion} />)}
        {!viajes.length && <div className="card historial-vacio">No hay viajes históricos para los filtros seleccionados.</div>}
      </div>}
    {seleccion && <Modal ancho="extra" onClose={() => setSeleccion(null)}>
      <div className="historial-modal-cabecera">
        <div><h2>Detalle del viaje</h2><p>{seleccion.origen} → {seleccion.destino} · {formatoFecha(seleccion.fecha)}</p></div>
        <button type="button" className="btn" onClick={() => setSeleccion(null)}>Cerrar</button>
      </div>
      <DetalleViaje viajeInicial={seleccion} />
    </Modal>}
  </div>
}
