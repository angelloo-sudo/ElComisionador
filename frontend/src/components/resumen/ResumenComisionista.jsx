// Resumen del comisionista: lo que tiene que atender hoy y lo que viene.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Alerta, ESTADOS_VIAJE } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'
import { formatoPesos } from '../../utils/tarifa.js'
import { cuando, plural } from './util.js'
import { estadoVisibleViaje, hoyEnCordoba } from '../../utils/estadoViaje.js'
import '../../styles/resumen.css'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function fechaActual() {
  const texto = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function inicioMesActual() {
  const [anio, mes] = hoyEnCordoba().split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, 1))
}

function claveFecha(fecha) {
  return String(fecha).slice(0, 10)
}

// El calendario usa los mismos estados y colores que la lista de Viajes.
function estadoCalendario(estado) {
  return ESTADOS_VIAJE[estado] ?? { texto: estado, clase: 'gris' }
}

function CalendarioViajes({ viajes }) {
  const [mes, setMes] = useState(inicioMesActual)
  const [tooltip, setTooltip] = useState(null)
  const hoy = hoyEnCordoba()
  const anio = mes.getUTCFullYear()
  const numeroMes = mes.getUTCMonth()
  const primerDia = new Date(Date.UTC(anio, numeroMes, 1))
  const desplazamiento = (primerDia.getUTCDay() + 6) % 7
  const diasDelMes = new Date(Date.UTC(anio, numeroMes + 1, 0)).getUTCDate()
  const cantidadCeldas = 42
  const tituloMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(mes)
  const viajesVisibles = viajes.filter((viaje) => !['cancelado', 'vencido'].includes(estadoVisibleViaje(viaje.estado, viaje.fecha)))
  const viajesPorFecha = viajesVisibles.reduce((grupos, viaje) => {
    const fecha = claveFecha(viaje.fecha)
    grupos[fecha] ??= []
    grupos[fecha].push(viaje)
    return grupos
  }, {})

  function mostrarDetalle(evento, viaje) {
    const rect = evento.currentTarget.getBoundingClientRect()
    const anchoTooltip = Math.min(280, window.innerWidth - 16)
    const altoTooltip = 96
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - anchoTooltip - 8))
    const top = rect.bottom + altoTooltip + 8 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - altoTooltip - 8)
    setTooltip({ viaje, left, top })
  }

  return (
    <>
    <section className="card calendario-viajes" aria-label="Calendario de viajes">
      <div className="card-cabecera calendario-cabecera">
        <div>
          <h2>Calendario de viajes</h2>
          <p>Todos tus viajes con su estado.</p>
        </div>
        <div className="calendario-controles">
          <button type="button" className="btn" aria-label="Mes anterior" onClick={() => setMes(new Date(Date.UTC(anio, numeroMes - 1, 1)))}>‹</button>
          <strong aria-live="polite">{tituloMes.charAt(0).toUpperCase() + tituloMes.slice(1)}</strong>
          <button type="button" className="btn calendario-hoy" onClick={() => setMes(inicioMesActual())}>Hoy</button>
          <button type="button" className="btn" aria-label="Mes siguiente" onClick={() => setMes(new Date(Date.UTC(anio, numeroMes + 1, 1)))}>›</button>
        </div>
      </div>
      <div className="calendario-leyenda" aria-label="Estados de los viajes">
        {Object.entries(ESTADOS_VIAJE).filter(([valor]) => !['cancelado', 'vencido'].includes(valor)).map(([valor, e]) => <span key={valor}><i className={e.clase} />{e.texto}</span>)}
      </div>
      <div className="calendario-grilla">
        {DIAS_SEMANA.map((dia) => <div key={dia} className="calendario-dia-semana">{dia}</div>)}
        {Array.from({ length: cantidadCeldas }, (_, indice) => {
          const numeroDia = indice - desplazamiento + 1
          const dentroDelMes = numeroDia >= 1 && numeroDia <= diasDelMes
          if (!dentroDelMes) return <div key={`vacio-${indice}`} className="calendario-celda fuera-mes" aria-hidden="true" />

          const fecha = `${anio}-${String(numeroMes + 1).padStart(2, '0')}-${String(numeroDia).padStart(2, '0')}`
          const delDia = viajesPorFecha[fecha] ?? []
          const esHoy = fecha === hoy
          return (
            <div key={fecha} className={`calendario-celda${esHoy ? ' hoy' : ''}`} role="group" aria-label={`${numeroDia} de ${tituloMes}${esHoy ? ', hoy' : ''}`} aria-current={esHoy ? 'date' : undefined}>
              <span className="calendario-numero">{numeroDia}</span>
              <div className="calendario-salidas">
                {delDia.map((viaje) => {
                  const estado = estadoCalendario(viaje.estado)
                  const detalles = `${viaje.hora_salida ? String(viaje.hora_salida).slice(0, 5) : 'Sin hora'} · ${viaje.origen} → ${viaje.destino} · ${viaje.pasajeros_ocupados}/${viaje.cupo_total ?? '—'} Pasajeros · ${viaje.encomiendas} Encomiendas · ${estado.texto}`
                  return (
                    <span
                      key={viaje.id}
                      className={`calendario-salida ${estado.clase}`}
                      tabIndex={0}
                      aria-label={detalles}
                      aria-describedby={tooltip?.viaje.id === viaje.id ? `calendario-tooltip-${viaje.id}` : undefined}
                      onMouseEnter={(evento) => mostrarDetalle(evento, viaje)}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(evento) => mostrarDetalle(evento, viaje)}
                      onBlur={() => setTooltip(null)}
                    >
                      <span className="calendario-hora">{viaje.hora_salida ? String(viaje.hora_salida).slice(0, 5) : 'Sin hora'}</span>
                      <span className="calendario-recorrido">{viaje.origen} → {viaje.destino}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
    {tooltip && createPortal(
      <div
        id={`calendario-tooltip-${tooltip.viaje.id}`}
        className="calendario-tooltip"
        role="tooltip"
        style={{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }}
      >
        <strong>{tooltip.viaje.origen} → {tooltip.viaje.destino}</strong>
        <span>{tooltip.viaje.pasajeros_ocupados}/{tooltip.viaje.cupo_total ?? '—'} Pasajeros · {tooltip.viaje.encomiendas} Encomiendas</span>
        <span>{estadoCalendario(tooltip.viaje.estado).texto}</span>
      </div>,
      document.body,
    )}
    </>
  )
}

function Kpi({ titulo, valor, detalle, a, destacado, chico }) {
  const contenido = <><small>{titulo}</small><strong>{valor}</strong>{detalle && <span>{detalle}</span>}</>
  const clase = `kpi${destacado ? ' destacado' : ''}${chico ? ' chico' : ''}`
  return a ? <Link to={a} className={clase}>{contenido}</Link> : <div className={clase}>{contenido}</div>
}

function Cupo({ ocupados, total }) {
  if (total == null) return null
  const pct = total > 0 ? Math.min(100, Math.round((ocupados / total) * 100)) : 0
  return (
    <div>
      <div className="cupo-texto"><span>Cupos ocupados</span><b>{ocupados} / {total}</b></div>
      <div className="cupo-barra"><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function ResumenComisionista({ datos, nombre }) {
  const { proximo_viaje: proximo, totales: t, alertas, pendientes, agenda, viajes_calendario: viajesCalendario } = datos
  const fecha = fechaActual()
  return (
    <div className="resumen resumen-comisionista">
      <header className="resumen-saludo">
        <div>
          <p className="comisionista-fecha">{fecha}</p>
          <h2>Buen día, {nombre || 'comisionista'}</h2>
          <p>{proximo ? 'Esto es lo que tenés por delante.' : 'Todavía no tenés viajes programados.'}</p>
        </div>
      </header>

      {(alertas.sin_tarifa || alertas.pendientes_urgentes.length > 0 || alertas.viajes_sin_ruta > 0) && (
        <div className="resumen-alertas">
          {alertas.pendientes_urgentes.map((v) => (
            <Alerta key={v.viaje_id} tipo="aviso" titulo="Solicitudes por responder">
              El viaje {codigoViaje(v.viaje_id)} ({v.origen} → {v.destino}) sale {cuando(v.fecha, v.hora_salida).toLowerCase()} y tiene {plural(v.pendientes, 'solicitud', 'solicitudes')} sin responder. <Link to="/solicitudes">Ir a Solicitudes</Link>
            </Alerta>
          ))}
          {alertas.sin_tarifa && (
            <Alerta tipo="aviso" titulo="Todavía no configuraste tu precio por km">
              Sin tarifa, los clientes ven el monto como “A convenir”. <Link to="/tarifa">Configurar mi tarifa</Link>
            </Alerta>
          )}
          {alertas.viajes_sin_ruta > 0 && (
            <Alerta tipo="aviso" titulo="Viajes sin ruta calculada">
              {plural(alertas.viajes_sin_ruta, 'viaje no tiene', 'viajes no tienen')} la distancia calculada todavía (el servicio de mapas no respondió). Se completa solo cuando un cliente se postula. <Link to="/viajes">Ver viajes</Link>
            </Alerta>
          )}
        </div>
      )}

      <div className="resumen-kpis comisionista-kpis-principales">
        <Kpi titulo="Viajes esta semana" valor={t.viajes_semana} detalle={t.viajes_hoy ? `${plural(t.viajes_hoy, 'sale hoy', 'salen hoy')}` : 'Ninguno sale hoy'} a="/viajes" />
        {t.gastos_mes != null && <Kpi titulo="Gastos del mes" valor={formatoPesos(t.gastos_mes)} a="/gastos" />}
      </div>

      <div className="resumen-cols comisionista-paneles">
        <section className="card">
          <div className="card-cabecera"><h2>Próximo viaje</h2></div>
          {proximo ? (
            <>
              <div className="card-cuerpo proximo">
                <div className="proximo-ruta">{proximo.origen}<span className="flecha">→</span>{proximo.destino}</div>
                <div className="proximo-cuando">Sale <b>{cuando(proximo.fecha, proximo.hora_salida)}</b> · {codigoViaje(proximo.id)}</div>
                <Cupo ocupados={proximo.ocupados} total={proximo.cupo_total} />
                <div className="proximo-datos">
                  <span className={`badge punto ${proximo.pendientes ? 'ambar' : 'gris'}`}>{plural(proximo.pendientes, 'solicitud pendiente', 'solicitudes pendientes')}</span>
                  <span className="badge punto gris">{plural(proximo.con_paradas, 'solicitud con paradas', 'solicitudes con paradas')}</span>
                  <span className="badge punto gris">{plural(proximo.encomiendas, 'encomienda', 'encomiendas')}</span>
                </div>
              </div>
              <div className="card-pie izq"><Link to="/viajes" className="btn">Ver detalle en Viajes</Link></div>
            </>
          ) : (
            <div className="resumen-vacio">No tenés viajes por salir.<br /><Link to="/viajes/nuevo" className="btn btn-primario">Registrar un viaje</Link></div>
          )}
        </section>

        <section className="card">
          <div className="card-cabecera"><h2>Solicitudes para responder</h2></div>
          {pendientes.length === 0 ? (
            <div className="resumen-vacio">No hay solicitudes pendientes.</div>
          ) : (
            <>
              <ul className="lista-resumen">
                {pendientes.map((s) => (
                  <li key={s.id}>
                    <div>
                      <span className="principal">{s.quien || 'Sin nombre'}</span>
                      <small>{s.tipo === 'encomienda' ? 'Encomienda' : plural(s.cantidad_pasajeros, 'pasajero', 'pasajeros')} · {s.sube} → {s.baja}</small>
                    </div>
                    <div className="derecha"><small>{cuando(s.fecha, s.hora_salida)}</small></div>
                  </li>
                ))}
              </ul>
              <div className="card-pie izq"><Link to="/solicitudes" className="btn btn-primario">Responder solicitudes</Link></div>
            </>
          )}
        </section>
      </div>

      {!Array.isArray(viajesCalendario) && (
        <section className="card">
          <div className="card-cabecera"><h2>Agenda</h2><p>Tus próximos viajes programados.</p></div>
          {agenda.length === 0 ? (
            <div className="resumen-vacio">No hay viajes programados.</div>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead><tr><th>N°</th><th>Recorrido</th><th>Salida</th><th>Cupos</th><th>Solicitudes</th></tr></thead>
                <tbody>
                  {agenda.map((v) => (
                    <tr key={v.id}>
                      <td className="codigo">{codigoViaje(v.id)}</td>
                      <td>{v.origen} → {v.destino}</td>
                      <td>{cuando(v.fecha, v.hora_salida)}</td>
                      <td>{v.cupo_total == null ? '—' : `${v.ocupados} / ${v.cupo_total}`}</td>
                      <td>{v.pendientes ? <span className="badge punto ambar">{v.pendientes} sin responder</span> : <span className="campo-ayuda">Al día</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {Array.isArray(viajesCalendario) && <CalendarioViajes viajes={viajesCalendario} />}
    </div>
  )
}
