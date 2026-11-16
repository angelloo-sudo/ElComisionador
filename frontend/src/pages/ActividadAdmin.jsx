import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, formatoFecha } from '../components/ui.jsx'
import AdminActivityList from '../components/admin/AdminActivityList.jsx'
import '../styles/admin.css'

const DECISIONES = {
  APROBADA_MANUALMENTE: ['Identidad aprobada', 'verde'],
  RECHAZADA: ['Identidad rechazada', 'rojo'],
  REQUIERE_CORRECCION: ['Corrección solicitada', 'ambar'],
}

export default function ActividadAdmin() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/actividad').then(setDatos).catch((e) => setError(e.message || 'No se pudo cargar la actividad.'))
  }, [])

  return (
    <section className="admin-pagina">
      <header className="admin-encabezado"><div><p className="auth-kicker">Administración</p><h2>Actividad e historial</h2><p>Movimientos recientes y decisiones de identidad registradas en el sistema.</p></div></header>
      {error && <Alerta tipo="error" titulo="No se pudo cargar el historial">{error}</Alerta>}
      {!datos && !error && <p className="campo-ayuda">Cargando actividad…</p>}
      {datos && (
        <>
          <section className="card admin-seccion">
            <div className="card-cabecera"><div><h2>Actividad reciente</h2><p>Altas, verificaciones, viajes y encomiendas.</p></div></div>
            <AdminActivityList items={datos.actividad} />
          </section>
          <section className="card admin-seccion">
            <div className="card-cabecera"><div><h2>Historial de decisiones de identidad</h2><p>Administrador, comisionista afectado, fecha y motivo registrados en cada resolución.</p></div></div>
            {!datos.decisiones.length ? <p className="admin-vacio">Todavía no hay decisiones administrativas registradas.</p> : (
              <div className="admin-decisiones">
                {datos.decisiones.map((decision) => {
                  const [texto, tono] = DECISIONES[decision.estado] ?? ['Decisión', 'gris']
                  return (
                    <article className="admin-decision-item" key={decision.id}>
                      <div className="admin-decision-cabecera">
                        <div><strong>{decision.usuario || decision.usuario_email}</strong><small>{decision.usuario_email}</small></div>
                        <span className={`badge ${tono}`}>{texto}</span>
                      </div>
                      <dl className="admin-decision-meta">
                        <div><dt>Administrador</dt><dd>{decision.administrador || decision.administrador_email || 'Cuenta no disponible'}</dd></div>
                        <div><dt>Fecha</dt><dd>{decision.resuelta_en ? new Date(decision.resuelta_en).toLocaleString('es-AR') : formatoFecha(decision.resuelta_en)}</dd></div>
                        {decision.motivo_resolucion && <div><dt>Motivo</dt><dd>{decision.motivo_resolucion}</dd></div>}
                      </dl>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
