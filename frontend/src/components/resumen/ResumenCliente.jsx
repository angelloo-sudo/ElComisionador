// Inicio del cliente: accesos a envíos y viajes, seguimiento y actividad real.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'
import { formatoPesos } from '../../utils/tarifa.js'
import { cuando, plural } from './util.js'
import '../../styles/resumen.css'

const ESTADO = {
  pendiente: { clase: 'ambar', texto: 'Pendiente' },
  aceptada: { clase: 'verde', texto: 'Aceptada' },
  rechazada: { clase: 'rojo', texto: 'Rechazada' },
  cancelada: { clase: 'gris', texto: 'Cancelada' },
}

const montoTexto = (m) => (m == null ? 'A convenir' : formatoPesos(m))

// Rechazada o cancelada por el cliente se muestran así aunque después se cancele el viaje;
// si no, un viaje cancelado se muestra como "Viaje cancelado".
function estadoMostrado(s) {
  if (['rechazada', 'cancelada'].includes(s.estado)) return ESTADO[s.estado]
  if (s.estado_viaje === 'cancelado') return { clase: 'rojo', texto: 'Viaje cancelado' }
  return ESTADO[s.estado] ?? { clase: 'gris', texto: s.estado }
}
const destinoSolicitudes = '/mis-traslados'

function fechaActual() {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
}

function fechaActividad(valor) {
  if (!valor) return ''
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '' : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(fecha)
}

function resumenEstadoEncomienda(s) {
  if (s.estado_viaje === 'cancelado' && !['rechazada', 'cancelada'].includes(s.estado)) return { texto: 'Viaje cancelado', clase: 'rojo', etapa: 0, cerrado: true }
  if (s.entregada_en) return { texto: 'Entregada', clase: 'verde', etapa: 3 }
  if (s.retirada_en) return { texto: 'En camino', clase: 'azul', etapa: 2 }
  if (s.estado === 'aceptada') return { texto: 'Confirmada', clase: 'verde', etapa: 1 }
  return { ...(ESTADO[s.estado] ?? { texto: s.estado, clase: 'gris' }), etapa: 0, cerrado: ['rechazada', 'cancelada'].includes(s.estado) }
}

function etiquetaSolicitud(s) {
  return s.tipo === 'encomienda' ? 'Solicitud de encomienda enviada' : 'Solicitud de viaje enviada'
}

function construirActividad(solicitudes) {
  const eventos = []
  solicitudes.forEach((s) => {
    const ruta = `${s.origen_localidad ?? s.origen} → ${s.destino_localidad ?? s.destino}`
    const agregar = (fecha, texto, icono, clase) => {
      if (fecha) eventos.push({ id: `${s.id}-${texto}`, fecha, texto, ruta, icono, clase, solicitudId: s.id })
    }
    agregar(s.creado_en, etiquetaSolicitud(s), s.tipo === 'encomienda' ? 'package' : 'seat', 'info')
    if (s.retirada_en) agregar(s.retirada_en, 'Retiro confirmado', 'package', 'ambar')
    if (s.entregada_en) agregar(s.entregada_en, 'Encomienda entregada', 'checkcircle', 'verde')
    if (s.subio_en) agregar(s.subio_en, 'Subiste al viaje', 'seat', 'info')
    if (s.llego_en) agregar(s.llego_en, 'Llegaste a destino', 'checkcircle', 'verde')
  })
  return eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5)
}

function AccesoRapido({ icono, titulo, texto, destino, pestana }) {
  return (
    <Link className="cliente-acceso" to={destino} state={pestana ? { pestana } : undefined}>
      <span className="cliente-acceso-icono"><Icon nombre={icono} tamano={19} /></span>
      <span className="cliente-acceso-texto"><strong>{titulo}</strong><small>{texto}</small></span>
      <Icon nombre="arrow" tamano={16} />
    </Link>
  )
}

function EncomiendaCard({ solicitud }) {
  const estado = resumenEstadoEncomienda(solicitud)
  const origen = solicitud.origen_localidad ?? solicitud.origen
  const destino = solicitud.destino_localidad ?? solicitud.destino
  return (
    <article className="cliente-encomienda">
      <div className="cliente-encomienda-cabecera">
        <span className="cliente-encomienda-icono"><Icon nombre="package" tamano={17} /></span>
        <span className="cliente-encomienda-id">Encomienda #{solicitud.id}</span>
        <span className={`badge punto ${estado.clase}`}>{estado.texto}</span>
      </div>
      <div className="cliente-encomienda-ruta">{origen}<span aria-hidden="true">→</span>{destino}</div>
      <p className="cliente-encomienda-detalle">
        {solicitud.retirada_en
          ? `Retirada ${fechaActividad(solicitud.retirada_en)}`
          : solicitud.estado === 'pendiente'
            ? 'Esperando respuesta del comisionista'
            : solicitud.estado === 'aceptada'
              ? `Retiro previsto para ${cuando(solicitud.fecha, solicitud.hora_salida)}`
              : solicitud.motivo_rechazo || `Solicitud ${estado.texto.toLowerCase()}`}
      </p>
      {!estado.cerrado && (
        <div className="cliente-encomienda-pasos" aria-label={`Estado del envío: ${estado.texto}`}>
          {['Solicitud', 'Retiro', 'Entrega'].map((paso, indice) => (
            <span key={paso} className={indice < estado.etapa ? 'completo' : indice === estado.etapa ? 'actual' : ''}>{paso}</span>
          ))}
        </div>
      )}
    </article>
  )
}

export default function ResumenCliente({ datos, nombre }) {
  const { proximo_traslado: proximo, totales: t, ultimas } = datos
  const [solicitudes, setSolicitudes] = useState([])
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [errorSolicitudes, setErrorSolicitudes] = useState('')

  useEffect(() => {
    let vigente = true
    api.get('/solicitudes/mias')
      .then((respuesta) => { if (vigente) setSolicitudes(respuesta) })
      .catch((error) => { if (vigente) setErrorSolicitudes(error.message || 'No se pudieron cargar tus envíos.') })
      .finally(() => { if (vigente) setCargandoSolicitudes(false) })
    return () => { vigente = false }
  }, [])

  const encomiendas = solicitudes.filter((s) => s.tipo === 'encomienda')
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)).slice(0, 4)
  const actividad = construirActividad(solicitudes)
  const nombreMostrado = nombre || 'cliente'
  const fecha = fechaActual()

  return (
    <div className="resumen resumen-cliente">
      <header className="cliente-inicio-cabecera">
        <div>
          <p className="cliente-fecha">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
          <h2>Hola, {nombreMostrado}</h2>
          <p>¿Qué necesitás enviar o planificar hoy?</p>
        </div>
      </header>

      {t.rechazadas_recientes > 0 && (
        <div className="resumen-alertas">
          <Alerta tipo="aviso" titulo="Tenés solicitudes rechazadas">
            {plural(t.rechazadas_recientes, 'solicitud fue rechazada', 'solicitudes fueron rechazadas')} en los últimos 30 días. <Link to={destinoSolicitudes} state={{ pestana: 'solicitudes' }}>Ver mis solicitudes</Link>
          </Alerta>
        </div>
      )}

      <section className="cliente-hero">
        <div className="cliente-hero-decoracion" aria-hidden="true" />
        <div className="cliente-hero-contenido">
          <span className="cliente-hero-icono"><Icon nombre="package" tamano={20} /></span>
          <h3>Enviá lo que necesitás, sin vueltas.</h3>
          <p>Pedí una encomienda, reservá tu viaje o seguí cada paso desde un solo lugar.</p>
          <div className="cliente-hero-acciones">
            <Link to="/mis-traslados" className="btn btn-primario"><Icon nombre="seat" tamano={15} /> Buscar un viaje <Icon nombre="arrow" tamano={14} /></Link>
          </div>
        </div>
        <div className="cliente-hero-resumen" aria-label="Resumen de solicitudes">
          <span><strong>{t.pendientes}</strong><small>Pendientes</small></span>
          <span><strong>{t.aceptadas}</strong><small>Confirmadas</small></span>
          <span><strong>{formatoPesos(t.a_pagar_aceptadas)}</strong><small>{t.a_pagar_pendientes ? `+ ${formatoPesos(t.a_pagar_pendientes)} pendientes` : 'A pagar'}</small></span>
        </div>
      </section>

      <nav className="cliente-accesos" aria-label="Accesos rápidos">
        <AccesoRapido icono="package" titulo="Encomienda" texto="Mandá un paquete a cualquier destino." destino="/mis-traslados" />
        <AccesoRapido icono="seat" titulo="Viaje" texto={`${plural(t.viajes_disponibles, 'viaje disponible', 'viajes disponibles')}.`} destino="/mis-traslados" />
        <AccesoRapido icono="repeat" titulo="Mis solicitudes" texto="Consultá tus envíos y traslados." destino={destinoSolicitudes} pestana="solicitudes" />
      </nav>

      <div className="cliente-inicio-columnas">
        <section className="card cliente-panel-encomiendas">
          <div className="card-cabecera">
            <div><h2>Tus encomiendas</h2><p>Seguí el estado de tus envíos</p></div>
          <Link to={destinoSolicitudes} state={{ pestana: 'solicitudes' }} className="cliente-ver-todas">Ver todas <Icon nombre="arrow" tamano={14} /></Link>
          </div>
          {errorSolicitudes && <div className="cliente-error"><Alerta tipo="error" titulo="No se pudieron cargar tus solicitudes">{errorSolicitudes}</Alerta></div>}
          {cargandoSolicitudes ? <p className="resumen-vacio cliente-vacio-actividad">Cargando tus encomiendas...</p> : encomiendas.length ? (
            <div className="cliente-encomiendas-lista">{encomiendas.map((s) => <EncomiendaCard key={s.id} solicitud={s} />)}</div>
          ) : !errorSolicitudes ? (
            <div className="resumen-vacio cliente-vacio">Todavía no tenés encomiendas.<Link to="/mis-traslados" className="btn">Enviar una encomienda</Link></div>
          ) : null}
        </section>

        <aside className="cliente-columna-lateral">
          <section className="card cliente-panel-actividad">
            <div className="card-cabecera"><div><h2>Actividad reciente</h2><p>Movimientos de tus envíos y viajes</p></div></div>
            {actividad.length ? (
              <ul className="cliente-actividad-lista">
                {actividad.map((evento) => (
                  <li key={evento.id}>
                    <span className={`cliente-actividad-icono ${evento.clase}`}><Icon nombre={evento.icono} tamano={15} /></span>
                    <span className="cliente-actividad-texto"><strong>{evento.texto}</strong><small>#{evento.solicitudId} · {evento.ruta}</small></span>
                    <time>{fechaActividad(evento.fecha)}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="resumen-vacio cliente-vacio-actividad">Todavía no hay movimientos para mostrar.</p>}
            <Link to={destinoSolicitudes} state={{ pestana: 'solicitudes' }} className="cliente-historial">Ver mis solicitudes <Icon nombre="arrow" tamano={14} /></Link>
          </section>

          {proximo && (
            <section className="card cliente-proximo">
              <div className="card-cabecera"><div><h2>Tu próximo traslado</h2><p>{proximo.tipo === 'encomienda' ? 'Encomienda' : plural(proximo.cantidad_pasajeros, 'pasajero', 'pasajeros')} · {codigoViaje(proximo.viaje_id)}</p></div></div>
              <div className="cliente-proximo-cuerpo">
                <strong>{proximo.sube}<span>→</span>{proximo.baja}</strong>
                <p>{cuando(proximo.fecha, proximo.hora_salida)}</p>
                <p>Comisionista: {proximo.comisionista}</p>
                <div className="cliente-proximo-pie"><span className="badge punto verde">Confirmado</span><span>{montoTexto(proximo.monto)}</span></div>
              </div>
              <div className="card-pie izq"><Link to={destinoSolicitudes} state={{ pestana: 'solicitudes' }} className="btn">Ver traslado</Link></div>
            </section>
          )}

          <section className="card cliente-panel-ultimas">
            <div className="card-cabecera"><div><h2>Últimas solicitudes</h2><p>Estado actual</p></div></div>
            {ultimas.length ? <ul className="lista-resumen">{ultimas.map((s) => (
              <li key={s.id}>
                <div><span className="principal">{s.sube} → {s.baja}</span><small>{s.tipo === 'encomienda' ? 'Encomienda' : plural(s.cantidad_pasajeros, 'pasajero', 'pasajeros')} · {cuando(s.fecha, s.hora_salida)} · {montoTexto(s.monto)}</small>{s.estado === 'rechazada' && s.motivo_rechazo && <small>Motivo: {s.motivo_rechazo}</small>}</div>
                <div className="derecha"><span className={`badge punto ${estadoMostrado(s).clase}`}>{estadoMostrado(s).texto}</span></div>
              </li>
            ))}</ul> : <p className="resumen-vacio">Todavía no hiciste ninguna solicitud.</p>}
          </section>
        </aside>
      </div>

      <div className="cliente-seguridad">
        <span className="cliente-seguridad-icono"><Icon nombre="checkcircle" tamano={19} /></span>
        <div><strong>Tus envíos están registrados</strong><p>Podés consultar el estado de cada solicitud cuando quieras.</p></div>
        <Link to={destinoSolicitudes}>Conocer más <Icon nombre="arrow" tamano={13} /></Link>
      </div>
    </div>
  )
}
