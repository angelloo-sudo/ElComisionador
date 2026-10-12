// US19 (comisionista): solicitudes que llegan de los clientes para sus viajes
// (pasajero o encomienda). Las acepta o las rechaza; al aceptar un pasajero se actualiza el cupo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo, formatoFecha, Modal, Toast } from '../components/ui.jsx'
import { BadgeSolicitud } from './MisTraslados.jsx'
import { codigoViaje } from './ViajeNuevo.jsx'

const ESTADOS = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aceptada', texto: 'Aceptadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'todas', texto: 'Todas' },
]
const CONTENIDOS = {
  electronica: 'Electrónica', ropa: 'Ropa', alimentos: 'Comestibles', libros: 'Libros',
  hogar: 'Hogar', documentacion: 'Documentación', juguetes: 'Juguetes', otro: 'Otro',
}
// Una sola pantalla "Solicitudes" con dos pestañas: pasajeros y encomiendas.
const TEXTOS = {
  pasajero: {
    titulo: 'Solicitudes', ayuda: 'Clientes que quieren sumarse a tus viajes como pasajeros. Revisá los datos y aceptá o rechazá cada solicitud.',
    vacioPendiente: 'No tenés solicitudes pendientes.', modal: 'Solicitud de pasajero',
  },
  encomienda: {
    titulo: 'Encomiendas', ayuda: 'Clientes que quieren enviar un paquete en tus viajes. Revisá los datos y aceptá o rechazá cada encomienda.',
    vacioPendiente: 'No tenés encomiendas pendientes.', modal: 'Solicitud de encomienda',
  },
}

const fecha = (f) => formatoFecha(`${f}T12:00:00`)
const direccion = (s, p) => `${s[`${p}_calle`]} ${s[`${p}_altura`]}, ${s[`${p}_barrio`]}`

function Fila({ etiqueta, children }) {
  return <div className="resumen-fila"><span>{etiqueta}</span><strong>{children}</strong></div>
}

function DetalleSolicitud({ s }) {
  return (
    <div className="viaje-detalle">
      <Fila etiqueta="Viaje">{codigoViaje(s.viaje_id)} · {s.origen} → {s.destino}</Fila>
      <Fila etiqueta="Salida">{fecha(s.fecha)} · {s.hora_salida?.slice(0, 5)}</Fila>
      <Fila etiqueta="Cliente (cuenta)">{s.cliente_email}</Fila>
      {s.tipo === 'pasajero' ? (
        <>
          <Fila etiqueta="Pasajero">{s.nombre} {s.apellido}</Fila>
          <Fila etiqueta="DNI">{s.dni}</Fila>
          <Fila etiqueta="Celular">{s.telefono}</Fila>
          <Fila etiqueta="Cantidad de pasajeros">{s.cantidad_pasajeros}</Fila>
          <Fila etiqueta="Equipaje">{s.lleva_equipaje ? s.equipaje_detalle : 'No lleva'}</Fila>
        </>
      ) : (
        <>
          <Fila etiqueta="Tipo de contenido">{CONTENIDOS[s.tipo_contenido] ?? s.tipo_contenido ?? '-'}{s.contenido_descripcion ? `: ${s.contenido_descripcion}` : ''}</Fila>
          <Fila etiqueta="¿Es frágil?">{s.fragil ? 'Sí, es frágil' : 'No'}</Fila>
          <Fila etiqueta="Peso">{Number(s.peso_kg)} kg</Fila>
          <Fila etiqueta="Medidas (ancho × largo)">{Number(s.ancho_cm)} × {Number(s.largo_cm)} cm</Fila>
          <Fila etiqueta="Emisor">{s.emisor_nombre} {s.emisor_apellido} · {s.emisor_telefono}</Fila>
          <Fila etiqueta="Receptor">{s.receptor_nombre} {s.receptor_apellido} · {s.receptor_telefono}</Fila>
        </>
      )}
      <Fila etiqueta="Forma de pago">{s.forma_pago === 'efectivo' ? 'Efectivo' : s.forma_pago === 'transferencia' ? 'Transferencia' : '-'}</Fila>
      <Fila etiqueta={s.tipo === 'pasajero' ? 'Lo buscan en' : 'Se retira en'}>{direccion(s, 'origen')}</Fila>
      {s.origen_descripcion && <Fila etiqueta="Referencias">{s.origen_descripcion}</Fila>}
      <Fila etiqueta={s.tipo === 'pasajero' ? 'Se baja en' : 'Se entrega en'}>{direccion(s, 'destino')}</Fila>
      <Fila etiqueta="Estado"><BadgeSolicitud estado={s.estado} /></Fila>
      {s.estado === 'rechazada' && s.motivo_rechazo && <Fila etiqueta="Motivo del rechazo">{s.motivo_rechazo}</Fila>}
    </div>
  )
}

export default function Postulaciones() {
  const [tipoFijo, setTipoFijo] = useState('pasajero')
  const textos = TEXTOS[tipoFijo]
  const ultimoPedido = useRef(0)
  const [estado, setEstado] = useState('pendiente')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [aRechazar, setARechazar] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [toast, setToast] = useState(null)
  const cerrarToast = useCallback(() => setToast(null), [])

  const cargar = useCallback(async (e) => {
    const pedido = ++ultimoPedido.current // solo se muestra la respuesta del último pedido (al cambiar de pestaña rápido)
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ estado: e, tipo: tipoFijo })
      const datos = await api.get(`/solicitudes/recibidas?${params.toString()}`)
      if (pedido === ultimoPedido.current) setLista(datos)
    } catch (err) {
      if (pedido === ultimoPedido.current) setError(err.message || 'No se pudieron cargar las solicitudes.')
    } finally {
      if (pedido === ultimoPedido.current) setCargando(false)
    }
  }, [tipoFijo])

  useEffect(() => { cargar(estado) }, [cargar, estado])

  async function resolver(s, accion) {
    setProcesando(s.id)
    setErrorAccion('')
    try {
      const r = await api.patch(`/solicitudes/${s.id}/${accion}`, accion === 'rechazar' ? { motivo: motivo.trim() } : {})
      setARechazar(null)
      setMotivo('')
      setDetalle(null)
      setToast(accion === 'aceptar'
        ? { titulo: 'Solicitud aceptada', texto: s.tipo === 'pasajero' ? `Cupo del viaje ${codigoViaje(s.viaje_id)}: ${r.ocupados} / ${r.cupo_total}.` : `Aceptaste la encomienda de ${s.emisor_nombre} ${s.emisor_apellido}.` }
        : { titulo: 'Solicitud rechazada', texto: motivo.trim() ? 'El cliente va a ver tu motivo.' : 'El cliente va a ver la solicitud como rechazada.' })
    } catch (err) {
      setErrorAccion(err.message || 'No se pudo completar la acción.')
      setARechazar(null)
      setDetalle(null)
    } finally {
      setProcesando(null)
      await cargar(estado)
    }
  }

  function cambiarPestana(tipo) {
    if (tipo === tipoFijo) return
    setTipoFijo(tipo)
    setLista([])
    setDetalle(null)
    setARechazar(null)
    setErrorAccion('')
  }

  const quien = (s) => (s.tipo === 'pasajero' ? `${s.nombre} ${s.apellido}` : `${s.emisor_nombre} ${s.emisor_apellido}`)
  const resumen = (s) => (s.tipo === 'pasajero'
    ? `${s.cantidad_pasajeros} pasajero${s.cantidad_pasajeros === 1 ? '' : 's'}${s.lleva_equipaje ? ' · con equipaje' : ''}`
    : `${CONTENIDOS[s.tipo_contenido] ?? 'Paquete'} · ${Number(s.peso_kg)} kg${s.fragil ? ' · frágil' : ''}`)

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Solicitudes</h2>
          <p>{textos.ayuda}</p>
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Tipo de solicitud">
        <button type="button" role="tab" aria-selected={tipoFijo === 'pasajero'} className={tipoFijo === 'pasajero' ? 'activo' : ''} onClick={() => cambiarPestana('pasajero')}>
          Pasajeros
        </button>
        <button type="button" role="tab" aria-selected={tipoFijo === 'encomienda'} className={tipoFijo === 'encomienda' ? 'activo' : ''} onClick={() => cambiarPestana('encomienda')}>
          Encomiendas
        </button>
      </div>

      <div className="card filtros filtros-1">
        <Campo label="Mostrar">
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADOS.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</select>
          <Icon nombre="down" />
        </Campo>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar las solicitudes">{error}</Alerta>}
      {errorAccion && <Alerta tipo="aviso" titulo="No se pudo resolver la solicitud" onCerrar={() => setErrorAccion('')}>{errorAccion}</Alerta>}

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando solicitudes...</p>
        ) : lista.length === 0 ? (
          <p className="vacio">{estado === 'pendiente' ? textos.vacioPendiente : 'No hay solicitudes para mostrar.'}</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Cliente</th><th>Solicitud</th><th>Viaje</th>{tipoFijo === 'pasajero' && <th>Cupo</th>}<th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((s) => {
                const libres = Math.max(s.cupo_total - s.ocupados, 0)
                const sinCupo = s.tipo === 'pasajero' && s.cantidad_pasajeros > libres
                return (
                  <tr key={s.id}>
                    <td><strong>{quien(s)}</strong><div className="campo-ayuda">{s.tipo === 'pasajero' ? s.telefono : s.emisor_telefono}</div></td>
                    <td>{resumen(s)}</td>
                    <td className="col-recorrido"><span className="codigo">{codigoViaje(s.viaje_id)}</span> {s.origen}<span className="flecha">→</span>{s.destino}<div className="campo-ayuda">{fecha(s.fecha)} · {s.hora_salida?.slice(0, 5)}</div></td>
                    {tipoFijo === 'pasajero' && <td>{s.ocupados} / {s.cupo_total}</td>}
                    <td><BadgeSolicitud estado={s.estado} /></td>
                    <td>
                      <div className="acciones-fila">
                        <button type="button" className="btn btn-chico" onClick={() => setDetalle(s)}>Ver detalle</button>
                        {s.estado === 'pendiente' && (
                          <>
                            <button type="button" className="btn btn-chico btn-primario" disabled={procesando === s.id || sinCupo}
                              title={sinCupo ? `Quedan ${libres} lugares y piden ${s.cantidad_pasajeros}` : undefined}
                              onClick={() => resolver(s, 'aceptar')}><Icon nombre="check" tamano={13} /> Aceptar</button>
                            <button type="button" className="btn btn-chico btn-peligro" disabled={procesando === s.id} onClick={() => { setMotivo(''); setARechazar(s) }}><Icon nombre="x" tamano={13} /> Rechazar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {detalle && (
        <Modal onClose={() => setDetalle(null)}>
          <h2>{textos.modal}</h2>
          <DetalleSolicitud s={detalle} />
          <div className="modal-acciones">
            {detalle.estado === 'pendiente' && (
              <>
                <button type="button" className="btn btn-peligro" onClick={() => { setMotivo(''); setARechazar(detalle); setDetalle(null) }}>Rechazar</button>
                <button type="button" className="btn btn-primario" disabled={procesando === detalle.id || (detalle.tipo === 'pasajero' && detalle.cantidad_pasajeros > Math.max(detalle.cupo_total - detalle.ocupados, 0))} onClick={() => resolver(detalle, 'aceptar')}>Aceptar</button>
              </>
            )}
            <button type="button" className="btn" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {aRechazar && (
        <Modal onClose={() => { if (!procesando) setARechazar(null) }}>
          <span className="modal-icono"><Icon nombre="x" tamano={22} /></span>
          <h2>¿Rechazar la solicitud?</h2>
          <p>Se va a rechazar la solicitud de {quien(aRechazar)} para el viaje {codigoViaje(aRechazar.viaje_id)} ({aRechazar.origen} → {aRechazar.destino}, {fecha(aRechazar.fecha)}).</p>
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <Campo label="Motivo del rechazo" opcional="(opcional)" ayuda="Se lo mostramos al cliente en Mis solicitudes.">
              <textarea className="area" rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Ese día salgo con el auto lleno" disabled={Boolean(procesando)} />
            </Campo>
          </div>
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={() => setARechazar(null)} disabled={Boolean(procesando)}>Volver</button>
            <button type="button" className="btn btn-peligro" onClick={() => resolver(aRechazar, 'rechazar')} disabled={Boolean(procesando)}>{procesando ? 'Rechazando...' : 'Rechazar solicitud'}</button>
          </div>
        </Modal>
      )}

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={cerrarToast} />}
    </section>
  )
}
