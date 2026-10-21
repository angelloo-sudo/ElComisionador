// Resumen del cliente: su proximo traslado, como van sus solicitudes y cuanto tiene que pagar.
import { Link } from 'react-router-dom'
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

function Kpi({ titulo, valor, detalle, a, destacado }) {
  const contenido = <><small>{titulo}</small><strong>{valor}</strong>{detalle && <span>{detalle}</span>}</>
  const clase = `kpi${destacado ? ' destacado' : ''}`
  return a ? <Link to={a} className={clase}>{contenido}</Link> : <div className={clase}>{contenido}</div>
}

export default function ResumenCliente({ datos, nombre }) {
  const { proximo_traslado: p, totales: t, ultimas } = datos
  return (
    <div className="resumen">
      <div className="resumen-saludo">
        <div>
          <h2>Hola, {nombre}</h2>
          <p>{p ? 'Tu próximo traslado ya está confirmado.' : 'Pedí un viaje o enviá una encomienda cuando quieras.'}</p>
        </div>
        <Link to="/mis-traslados" className="btn btn-primario">Buscar un viaje</Link>
      </div>

      {t.rechazadas_recientes > 0 && (
        <div className="resumen-alertas">
          <Alerta tipo="aviso" titulo="Tenés solicitudes rechazadas">
            {plural(t.rechazadas_recientes, 'solicitud fue rechazada', 'solicitudes fueron rechazadas')} en los últimos 30 días. <Link to="/mis-traslados">Ver mis traslados</Link>
          </Alerta>
        </div>
      )}

      <div className="resumen-kpis">
        <Kpi titulo="Esperando respuesta" valor={t.pendientes} detalle={t.pendientes ? 'El comisionista todavía no respondió' : 'Nada pendiente'} a="/mis-traslados" destacado={t.pendientes > 0} />
        <Kpi titulo="Confirmadas" valor={t.aceptadas} detalle="traslados y envíos por realizarse" a="/mis-traslados" />
        <Kpi titulo="Total a pagar" valor={formatoPesos(t.a_pagar_aceptadas)} detalle={t.a_pagar_pendientes ? `+ ${formatoPesos(t.a_pagar_pendientes)} si se aceptan las pendientes` : 'De tus solicitudes aceptadas'} />
        <Kpi titulo="Viajes disponibles" valor={t.viajes_disponibles} detalle="para solicitar ahora" a="/mis-traslados" />
      </div>

      <div className="resumen-cols">
        <section className="card">
          <div className="card-cabecera"><h2>Tu próximo traslado</h2></div>
          {p ? (
            <>
              <div className="card-cuerpo proximo">
                <div className="proximo-ruta">{p.sube}<span className="flecha">→</span>{p.baja}</div>
                <div className="proximo-cuando">Sale <b>{cuando(p.fecha, p.hora_salida)}</b> · {codigoViaje(p.viaje_id)}</div>
                <div className="proximo-cuando">Comisionista: <b>{p.comisionista}</b></div>
                <div className="proximo-datos">
                  <span className="badge punto verde">{p.tipo === 'encomienda' ? 'Encomienda' : plural(p.cantidad_pasajeros, 'pasajero', 'pasajeros')}</span>
                  <span className="badge punto gris">{montoTexto(p.monto)}</span>
                </div>
                {(p.sube !== p.origen || p.baja !== p.destino) && <p className="campo-ayuda">El viaje completo va de {p.origen} a {p.destino}; vos hacés solo este tramo.</p>}
              </div>
              <div className="card-pie izq"><Link to="/mis-traslados" className="btn">Ver mis traslados</Link></div>
            </>
          ) : (
            <div className="resumen-vacio">
              Todavía no tenés traslados confirmados.<br />
              <Link to="/mis-traslados" className="btn btn-primario">Ver viajes disponibles</Link>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-cabecera"><h2>Tus últimas solicitudes</h2></div>
          {ultimas.length === 0 ? (
            <div className="resumen-vacio">Todavía no hiciste ninguna solicitud.</div>
          ) : (
            <ul className="lista-resumen">
              {ultimas.map((s) => (
                <li key={s.id}>
                  <div>
                    <span className="principal">{s.sube} → {s.baja}</span>
                    <small>{s.tipo === 'encomienda' ? 'Encomienda' : plural(s.cantidad_pasajeros, 'pasajero', 'pasajeros')} · {cuando(s.fecha, s.hora_salida)} · {montoTexto(s.monto)}</small>
                    {s.estado === 'rechazada' && s.motivo_rechazo && <small>Motivo: {s.motivo_rechazo}</small>}
                  </div>
                  <div className="derecha"><span className={`badge punto ${ESTADO[s.estado]?.clase ?? 'gris'}`}>{ESTADO[s.estado]?.texto ?? s.estado}</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
