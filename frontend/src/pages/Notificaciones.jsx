import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta } from '../components/ui.jsx'

function fechaNotificacion(valor) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor))
}

export default function Notificaciones() {
  const [elementos, setElementos] = useState([])
  const [error, setError] = useState('')
  const cargar = useCallback(() => api.get('/notificaciones').then(setElementos).catch((e) => setError(e.message)), [])
  useEffect(() => { cargar() }, [cargar])

  async function marcarLeida(id) {
    try {
      await api.patch(`/notificaciones/${id}/leida`, {})
      setElementos((actuales) => actuales.map((n) => n.id === id ? { ...n, leida_en: new Date().toISOString() } : n))
      window.dispatchEvent(new Event('notificaciones:actualizadas'))
    } catch (e) { setError(e.message) }
  }

  return <section>
    <div className="barra-pagina"><div><h2>Notificaciones</h2><p>Información sobre tus viajes y solicitudes.</p></div><button type="button" className="btn" onClick={cargar}>Actualizar</button></div>
    {error && <Alerta tipo="error" titulo="No se pudieron cargar las notificaciones">{error}</Alerta>}
    {!error && elementos.length === 0 && <div className="card resumen-vacio">Todavía no tenés notificaciones.</div>}
    <div className="lista-notificaciones">{elementos.map((n) => <article className={`card notificacion-card${n.leida_en ? '' : ' no-leida'}`} key={n.id}>
      <span className="notificacion-icono"><Icon nombre="bell" tamano={19} /></span>
      <div className="notificacion-contenido"><div className="notificacion-titulo"><h3>{n.titulo}</h3>{!n.leida_en && <span className="badge punto ambar">Nueva</span>}</div>
        <p>{n.mensaje}</p><time>{fechaNotificacion(n.creado_en)}</time>
        <div className="notificacion-acciones"><Link className="btn btn-primario" to="/mis-traslados" onClick={() => marcarLeida(n.id)}>Consultar mis viajes</Link>{!n.leida_en && <button className="btn" type="button" onClick={() => marcarLeida(n.id)}>Marcar como leída</button>}</div>
      </div>
    </article>)}</div>
  </section>
}
