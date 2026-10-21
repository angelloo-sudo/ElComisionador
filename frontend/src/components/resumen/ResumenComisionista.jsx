// Resumen del comisionista: lo que tiene que atender hoy y lo que viene.
import { Link } from 'react-router-dom'
import { Alerta } from '../ui.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'
import { formatoPesos } from '../../utils/tarifa.js'
import { cuando, plural } from './util.js'
import '../../styles/resumen.css'

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
  const { proximo_viaje: proximo, totales: t, alertas, pendientes, agenda } = datos
  return (
    <div className="resumen">
      <div className="resumen-saludo">
        <div>
          <h2>Hola, {nombre}</h2>
          <p>{proximo ? 'Esto es lo que tenés por delante.' : 'Todavía no tenés viajes programados.'}</p>
        </div>
        <Link to="/viajes/nuevo" className="btn btn-primario">Registrar un viaje</Link>
      </div>

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

      <div className="resumen-kpis">
        <Kpi titulo="Solicitudes por responder" valor={t.solicitudes_pendientes} detalle={t.solicitudes_pendientes ? 'Esperan tu respuesta' : 'Estás al día'} a="/solicitudes" destacado={t.solicitudes_pendientes > 0} />
        <Kpi titulo="Viajes esta semana" valor={t.viajes_semana} detalle={t.viajes_hoy ? `${plural(t.viajes_hoy, 'sale hoy', 'salen hoy')}` : 'Ninguno sale hoy'} a="/viajes" />
        <Kpi titulo="Cupos libres" valor={t.cupos_libres} detalle={`en ${plural(t.viajes_programados, 'viaje programado', 'viajes programados')}`} />
        <Kpi titulo="Encomiendas aceptadas" valor={t.encomiendas_en_curso} detalle="en viajes por salir" />
        {t.gastos_mes != null && <Kpi titulo="Gastos del mes" valor={formatoPesos(t.gastos_mes)} a="/gastos" />}
        <Kpi titulo="Tu precio por km" valor={datos.precio_km != null ? formatoPesos(datos.precio_km) : 'Sin configurar'} a="/tarifa" chico={datos.precio_km == null} />
      </div>

      <div className="resumen-cols">
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
    </div>
  )
}
