import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const formularioInicial = {
  direccion_retiro: '',
  destinatario_nombre: '',
  destinatario_telefono: '',
  destinatario_direccion: '',
  tipo_contenido: '',
  peso_kg: '',
  dimensiones: '',
  fragil: '',
  descripcion: '',
}

const etiquetasTipoContenido = {
  electronica: 'Electrónica',
  ropa: 'Ropa',
  alimentos: 'Comestibles',
  libros: 'Libros',
  hogar: 'Hogar',
  documentacion: 'Documentación',
  juguetes: 'Juguetes',
  otro: 'Otro',
}

const etiquetasDimensiones = {
  '0.5x0.5': '0,5 × 0,5 m',
  '1x1': '1 × 1 m',
  '2x2': '2 × 2 m',
}

const etiquetasEstado = {
  pendiente: 'Pendiente',
  aceptado: 'Aceptado',
  retirado: 'Retirado',
  en_viaje: 'En viaje',
  entregado: 'Entregado',
}

function fechaHora(fecha) {
  return new Date(fecha).toLocaleString('es-AR')
}

export default function Encomiendas({ usuario }) {
  const esCliente = usuario?.rol === 'cliente'
  const esComisionista = usuario?.rol === 'comisionista' || usuario?.rol === 'administrador'
  const [formulario, setFormulario] = useState(formularioInicial)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [solicitudes, setSolicitudes] = useState([])
  const [solicitudEdicionId, setSolicitudEdicionId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [menuSolicitudId, setMenuSolicitudId] = useState(null)
  const [vista, setVista] = useState('cargando')
  const [seccionComisionista, setSeccionComisionista] = useState('pendientes')
  const [recargarSolicitudes, setRecargarSolicitudes] = useState(0)

  useEffect(() => {
    if (!esCliente && !esComisionista) return undefined

    let activo = true
    setVista('cargando')
    const ruta = esCliente
      ? '/encomiendas/mis-solicitudes'
      : `/encomiendas/${seccionComisionista}`
    api.get(ruta)
      .then((respuesta) => {
        if (!activo) return
        setSolicitudes(respuesta.solicitudes)
        setVista(esCliente
          ? respuesta.primera_solicitud_encomienda_realizada ? 'menu' : 'formulario'
          : 'bandeja')
      })
      .catch((err) => {
        if (!activo) return
        setError(err.message)
        setVista('error')
      })

    return () => { activo = false }
  }, [esCliente, esComisionista, recargarSolicitudes, seccionComisionista])

  function actualizarCampo(event) {
    const actualizado = { ...formulario, [event.target.name]: event.target.value }
    if (event.target.name === 'tipo_contenido' && event.target.value !== 'otro') {
      actualizado.descripcion = ''
    }
    setFormulario(actualizado)
  }

  async function enviarSolicitud(event) {
    event.preventDefault()
    setError('')
    setMensaje('')
    setEnviando(true)

    try {
      const datosSolicitud = {
        ...formulario,
        peso_kg: Number(formulario.peso_kg),
        fragil: formulario.fragil === 'true',
      }
      const respuesta = solicitudEdicionId
        ? await api.put(`/encomiendas/${solicitudEdicionId}`, datosSolicitud)
        : await api.post('/encomiendas', datosSolicitud)

      if (solicitudEdicionId) {
        setSolicitudes((actuales) => actuales.map((solicitud) => (
          solicitud.id === solicitudEdicionId ? respuesta.encomienda : solicitud
        )))
        setMensaje('Solicitud modificada correctamente.')
        setVista('solicitudes')
      } else {
        setSolicitudes((actuales) => [respuesta.encomienda, ...actuales])
        setMensaje(`Solicitud #${respuesta.encomienda.id} registrada. Estado: ${respuesta.encomienda.estado}.`)
        setVista('menu')
      }
      setFormulario(formularioInicial)
      setSolicitudEdicionId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function abrirEdicion(solicitud) {
    setSolicitudEdicionId(solicitud.id)
    setFormulario({
      direccion_retiro: solicitud.direccion_retiro ?? '',
      destinatario_nombre: solicitud.destinatario_nombre,
      destinatario_telefono: solicitud.destinatario_telefono,
      destinatario_direccion: solicitud.destinatario_direccion,
      tipo_contenido: solicitud.tipo_contenido,
      peso_kg: String(solicitud.peso_kg),
      dimensiones: solicitud.dimensiones,
      fragil: String(solicitud.fragil),
      descripcion: solicitud.descripcion ?? '',
    })
    setError('')
    setMenuSolicitudId(null)
    setVista('formulario')
  }

  async function eliminarSolicitud(id) {
    if (!window.confirm('¿Querés eliminar esta solicitud de envío?')) return

    try {
      await api.del(`/encomiendas/${id}`)
      setSolicitudes((actuales) => actuales.filter((solicitud) => solicitud.id !== id))
      setMensaje('Solicitud eliminada correctamente.')
      setMenuSolicitudId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function aceptarSolicitud(id) {
    setError('')
    try {
      const respuesta = await api.patch(`/encomiendas/${id}/aceptar`, {})
      setSolicitudes((actuales) => actuales.filter((solicitud) => solicitud.id !== id))
      setMensaje(`Solicitud #${id} aceptada. Estado del pago: ${respuesta.encomienda.estado_pago}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function cambiarEstadoSolicitud(id, estado) {
    setError('')
    try {
      const respuesta = await api.patch(`/encomiendas/${id}/estado`, { estado })
      setSolicitudes((actuales) => actuales.map((solicitud) => (
        solicitud.id === id ? { ...solicitud, ...respuesta.encomienda } : solicitud
      )))
      setMenuSolicitudId(null)
      setMensaje(`Solicitud #${id}: estado ${etiquetasEstado[estado]}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!esCliente && !esComisionista) {
    return (
      <section>
        <h1>Encomiendas</h1>
        <p>Registro y seguimiento de encomiendas (Epica 3 - core). Pendiente de implementar.</p>
      </section>
    )
  }

  if (vista === 'cargando') return <p role="status">Cargando solicitudes...</p>
  if (vista === 'error') {
    return (
      <section className="solicitud-encomienda">
        <p className="notificacion error" role="alert">{error}</p>
        <button type="button" onClick={() => setRecargarSolicitudes((intento) => intento + 1)}>
          Reintentar
        </button>
      </section>
    )
  }

  if (esCliente && vista === 'formulario') {
    return (
      <section className="solicitud-encomienda">
        <header className="solicitud-encomienda-cabecera">
          <p className="solicitud-encomienda-etiqueta">{solicitudEdicionId ? 'Mis solicitudes' : 'Nueva solicitud'}</p>
          <h1>{solicitudEdicionId ? 'Modificar envío' : 'Enviar una encomienda'}</h1>
          <p>Completá los datos del destinatario y las características del paquete.</p>
        </header>

        {error && <p className="notificacion error" role="alert">{error}</p>}

        <form className="solicitud-encomienda-form" onSubmit={enviarSolicitud}>
          <fieldset className="solicitud-remitente">
            <legend>Remitente</legend>
            <p>{[usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')}</p>
            <span>{usuario?.email}</span>
            {usuario?.telefono && <span>Tel. {usuario.telefono}</span>}
          </fieldset>

          <fieldset className="solicitud-destinatario">
            <legend>Destinatario</legend>
            <label>
              Nombre y apellido
              <input name="destinatario_nombre" value={formulario.destinatario_nombre} onChange={actualizarCampo} maxLength={120} autoComplete="name" required />
            </label>
            <label>
              Teléfono
              <input name="destinatario_telefono" type="tel" value={formulario.destinatario_telefono} onChange={actualizarCampo} maxLength={40} autoComplete="tel" required />
            </label>
            <label className="solicitud-campo-ancho">
              Dirección de entrega
              <input name="destinatario_direccion" value={formulario.destinatario_direccion} onChange={actualizarCampo} maxLength={200} autoComplete="street-address" required />
            </label>
          </fieldset>

          <label className="solicitud-campo-ancho">
            Dirección de retiro
            <input name="direccion_retiro" value={formulario.direccion_retiro} onChange={actualizarCampo} maxLength={200} autoComplete="street-address" required />
          </label>

          <label className="solicitud-caracteristicas">
            Tipo de contenido
            <select name="tipo_contenido" value={formulario.tipo_contenido} onChange={actualizarCampo} required>
              <option value="">Seleccioná un tipo</option>
              <option value="electronica">Electrónica</option>
              <option value="ropa">Ropa</option>
              <option value="alimentos">Comestibles</option>
              <option value="libros">Libros</option>
              <option value="hogar">Hogar</option>
              <option value="documentacion">Documentación</option>
              <option value="juguetes">Juguetes</option>
              <option value="otro">Otro</option>
            </select>
          </label>

          <label>
            Peso
            <select name="peso_kg" value={formulario.peso_kg} onChange={actualizarCampo} required>
              <option value="">Seleccioná un peso</option>
              <option value="0.5">0,5 kg</option>
              <option value="1">1 kg</option>
              <option value="2">2 kg</option>
              <option value="5">5 kg</option>
              <option value="10">10 kg</option>
              <option value="20">20 kg</option>
            </select>
          </label>

          <label>
            Dimensiones
            <select name="dimensiones" value={formulario.dimensiones} onChange={actualizarCampo} required>
              <option value="">Seleccioná dimensiones</option>
              <option value="0.5x0.5">0,5 × 0,5 m</option>
              <option value="1x1">1 × 1 m</option>
              <option value="2x2">2 × 2 m</option>
            </select>
          </label>

          <label>
            ¿Es frágil?
            <select name="fragil" value={formulario.fragil} onChange={actualizarCampo} required>
              <option value="">Seleccioná una opción</option>
              <option value="true">Sí, es frágil</option>
              <option value="false">No es frágil</option>
            </select>
          </label>

          {formulario.tipo_contenido === 'otro' && (
            <label className="solicitud-descripcion-otro">
              Aclaración del contenido
              <textarea name="descripcion" value={formulario.descripcion} onChange={actualizarCampo} maxLength={300} rows={2} required />
            </label>
          )}

          <div className="solicitud-formulario-acciones">
            {solicitudEdicionId && (
              <button type="button" className="boton-secundario" onClick={() => setVista('solicitudes')}>
                Cancelar
              </button>
            )}
            <button type="submit" disabled={enviando}>
              {enviando ? 'Guardando...' : solicitudEdicionId ? 'Guardar cambios' : 'Registrar solicitud'}
            </button>
          </div>
        </form>
      </section>
    )
  }

  if (vista === 'solicitudes') {
    return (
      <section className="solicitud-encomienda">
        <header className="solicitud-encomienda-cabecera">
          <p className="solicitud-encomienda-etiqueta">Encomiendas</p>
          <h1>Mis solicitudes de envío</h1>
        </header>
        {mensaje && <p className="notificacion exito" role="status">{mensaje}</p>}
        {error && <p className="notificacion error" role="alert">{error}</p>}
        {solicitudes.length === 0 ? (
          <p>Todavía no tenés solicitudes de envío.</p>
        ) : (
          <div className="solicitudes-lista">
            {solicitudes.map((solicitud) => (
              <article className="solicitud-item" key={solicitud.id}>
                <div className="solicitud-item-contenido">
                  <h2>Solicitud #{solicitud.id}</h2>
                  <p><strong>Destinatario:</strong> {solicitud.destinatario_nombre} · {solicitud.destinatario_telefono}</p>
                  <p><strong>Entrega:</strong> {solicitud.destinatario_direccion}</p>
                  <p><strong>Contenido:</strong> {etiquetasTipoContenido[solicitud.tipo_contenido] ?? solicitud.tipo_contenido}{solicitud.descripcion ? `: ${solicitud.descripcion}` : ''}</p>
                  <p><strong>Peso:</strong> {solicitud.peso_kg} kg · <strong>Dimensiones:</strong> {etiquetasDimensiones[solicitud.dimensiones] ?? solicitud.dimensiones}</p>
                  <p><strong>Frágil:</strong> {solicitud.fragil ? 'Sí' : 'No'} · <strong>Estado:</strong> {etiquetasEstado[solicitud.estado] ?? solicitud.estado}</p>
                  <p><strong>Solicitada:</strong> {fechaHora(solicitud.fecha_solicitud)}</p>
                  {solicitud.estado_pago && (
                    <p><strong>Estado del pago:</strong> {solicitud.estado_pago === 'pendiente' ? 'Pendiente' : solicitud.estado_pago}</p>
                  )}
                  {solicitud.historial?.length > 0 && (
                    <div className="solicitud-historial">
                      <strong>Historial</strong>
                      {solicitud.historial.map((evento) => (
                        <p key={evento.id}>{etiquetasEstado[evento.estado] ?? evento.estado} · {fechaHora(evento.fecha_hora)}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="solicitud-item-menu">
                  <button
                    type="button"
                    aria-label={`Opciones de la solicitud ${solicitud.id}`}
                    aria-expanded={menuSolicitudId === solicitud.id}
                    onClick={() => setMenuSolicitudId(menuSolicitudId === solicitud.id ? null : solicitud.id)}
                  >
                    ⋮
                  </button>
                  {menuSolicitudId === solicitud.id && (
                    <div className="solicitud-menu-opciones">
                      <button type="button" onClick={() => abrirEdicion(solicitud)}>Modificar</button>
                      <button type="button" onClick={() => eliminarSolicitud(solicitud.id)}>Eliminar</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <button type="button" className="boton-secundario" onClick={() => setVista('menu')}>
          Volver al menú
        </button>
      </section>
    )
  }

  if (esComisionista && vista === 'bandeja') {
    const mostrandoPendientes = seccionComisionista === 'pendientes'

    return (
      <section className="solicitud-encomienda">
        <header className="solicitud-encomienda-cabecera">
          <p className="solicitud-encomienda-etiqueta">Revisión</p>
          <h1>{mostrandoPendientes ? 'Solicitudes pendientes' : 'Encomiendas aceptadas'}</h1>
        </header>
        <div className="encomiendas-secciones" role="group" aria-label="Sección de encomiendas">
          <button
            type="button"
            className={mostrandoPendientes ? 'activo' : ''}
            aria-pressed={mostrandoPendientes}
            onClick={() => {
              setMensaje('')
              setError('')
              setSeccionComisionista('pendientes')
            }}
          >
            Pendientes
          </button>
          <button
            type="button"
            className={!mostrandoPendientes ? 'activo' : ''}
            aria-pressed={!mostrandoPendientes}
            onClick={() => {
              setMensaje('')
              setError('')
              setSeccionComisionista('aceptadas')
            }}
          >
            Aceptadas
          </button>
        </div>
        {mensaje && <p className="notificacion exito" role="status">{mensaje}</p>}
        {error && <p className="notificacion error" role="alert">{error}</p>}
        {solicitudes.length === 0 ? (
          <p>{mostrandoPendientes ? 'No hay solicitudes pendientes.' : 'Todavía no hay encomiendas aceptadas.'}</p>
        ) : (
          <div className="solicitudes-lista">
            {solicitudes.map((solicitud) => (
              <article className="solicitud-item solicitud-item-comisionista" key={solicitud.id}>
                <div className="solicitud-item-contenido">
                  <h2>Solicitud #{solicitud.id}</h2>
                  <p><strong>Remitente:</strong> {solicitud.remitente_nombre} · {solicitud.remitente_telefono}</p>
                  <p><strong>Retiro:</strong> {solicitud.direccion_retiro}</p>
                  <p><strong>Destinatario:</strong> {solicitud.destinatario_nombre} · {solicitud.destinatario_telefono}</p>
                  <p><strong>Entrega:</strong> {solicitud.destinatario_direccion}</p>
                  <p><strong>Contenido:</strong> {etiquetasTipoContenido[solicitud.tipo_contenido] ?? solicitud.tipo_contenido}{solicitud.descripcion ? `: ${solicitud.descripcion}` : ''}</p>
                  <p><strong>Peso:</strong> {solicitud.peso_kg} kg · <strong>Dimensiones:</strong> {etiquetasDimensiones[solicitud.dimensiones] ?? solicitud.dimensiones}</p>
                  <p><strong>Solicitada:</strong> {fechaHora(solicitud.fecha_solicitud)}</p>
                  {!mostrandoPendientes && (
                    <>
                      <p><strong>Estado del pago:</strong> {solicitud.estado_pago === 'pendiente' ? 'Pendiente' : solicitud.estado_pago}</p>
                      {solicitud.historial?.length > 0 && (
                        <div className="solicitud-historial">
                          <strong>Historial</strong>
                          {solicitud.historial.map((evento) => (
                            <p key={evento.id}>{etiquetasEstado[evento.estado] ?? evento.estado} · {fechaHora(evento.fecha_hora)}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <span className={`solicitud-estado solicitud-estado-${solicitud.estado}`}>
                  <span aria-hidden="true" />
                  {etiquetasEstado[solicitud.estado] ?? solicitud.estado}
                </span>
                {mostrandoPendientes ? (
                  <button type="button" onClick={() => aceptarSolicitud(solicitud.id)}>Aceptar</button>
                ) : (
                  <div className="solicitud-item-menu">
                    <button
                      type="button"
                      aria-label={`Cambiar estado de la encomienda ${solicitud.id}`}
                      aria-expanded={menuSolicitudId === solicitud.id}
                      onClick={() => setMenuSolicitudId(menuSolicitudId === solicitud.id ? null : solicitud.id)}
                    >
                      ⋮
                    </button>
                    {menuSolicitudId === solicitud.id && (
                      <div className="solicitud-menu-opciones">
                        <button type="button" onClick={() => cambiarEstadoSolicitud(solicitud.id, 'aceptado')}>Aceptado</button>
                        <button type="button" onClick={() => cambiarEstadoSolicitud(solicitud.id, 'retirado')}>Retirado</button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="card">
      <div className="card-cabecera">
        <div>
          <h2>Encomiendas</h2>
          <p>Gestioná solicitudes y revisá el estado de tus envíos.</p>
        </div>
      </div>
      {mensaje && <p className="notificacion exito" role="status">{mensaje}</p>}
      <div className="encomiendas-menu">
        <button type="button" onClick={() => {
          setFormulario(formularioInicial)
          setSolicitudEdicionId(null)
          setMensaje('')
          setVista('formulario')
        }}>
          Solicitar envío
        </button>
        <button type="button" className="boton-secundario" onClick={() => {
          setMensaje('')
          setVista('solicitudes')
        }}>
          Mis solicitudes de envío
        </button>
      </div>
    </section>
  )
}
