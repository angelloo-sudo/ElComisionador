import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta } from '../components/ui.jsx'
import AdminActivityList from '../components/admin/AdminActivityList.jsx'
import Icon from '../components/Icon.jsx'
import '../styles/admin.css'

const PRINCIPALES = [
  ['clientes', 'Clientes registrados', 'users'],
  ['comisionistas', 'Comisionistas registrados', 'users'],
  ['comisionistas_activos', 'Comisionistas activos', 'checkcircle'],
  ['comisionistas_pendientes', 'Pendientes de verificación', 'idcard'],
  ['comisionistas_aprobados', 'Identidades aprobadas', 'checkcircle'],
  ['comisionistas_rechazados', 'Identidades rechazadas', 'alert'],
  ['viajes_total', 'Viajes publicados', 'logo'],
  ['encomiendas_total', 'Encomiendas registradas', 'package'],
]

const OPERACIONALES = [
  ['viajes_activos', 'Viajes activos'],
  ['viajes_finalizados', 'Viajes finalizados'],
  ['encomiendas_pendientes', 'Encomiendas pendientes'],
  ['encomiendas_entregadas', 'Encomiendas entregadas'],
  ['comisionistas_en_proceso', 'Verificaciones en proceso'],
  ['comisionistas_requieren_correccion', 'Correcciones solicitadas'],
]

const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function mesLegible(mes) {
  const [anio, numero] = mes.split('-').map(Number)
  return `${NOMBRES_MESES[numero - 1]} ${String(anio).slice(-2)}`
}

export default function AdminDashboard() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setDatos(await api.get('/admin/resumen'))
    } catch (e) {
      setError(e.message || 'No se pudo cargar el estado de la plataforma.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  if (cargando && !datos) return <p className="campo-ayuda">Cargando datos de administración…</p>
  if (!datos) return <Alerta tipo="error" titulo="No se pudo cargar el panel">{error}</Alerta>

  const maxRegistros = Math.max(1, ...datos.registros.flatMap((mes) => [mes.clientes, mes.comisionistas]))

  return (
    <section className="admin-pagina">
      <header className="admin-encabezado">
        <div>
          <p className="auth-kicker">Administración de ComiTrack</p>
          <h2>Estado general</h2>
          <p>Indicadores calculados con los registros actuales de la plataforma.</p>
        </div>
        <button type="button" className="btn" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error && <Alerta tipo="error" titulo="No se pudieron actualizar los datos">{error}</Alerta>}

      <div className="admin-kpis">
        {PRINCIPALES.map(([campo, titulo, icono]) => (
          <article className="card admin-kpi" key={campo}>
            <span className="admin-kpi-icono"><Icon nombre={icono} tamano={19} /></span>
            <span>{titulo}</span>
            <strong>{datos.estadisticas[campo] ?? 0}</strong>
          </article>
        ))}
      </div>

      <section className="card admin-seccion">
        <div className="card-cabecera">
          <div><h2>Supervisión operativa</h2><p>Estado actual de viajes, encomiendas y revisiones.</p></div>
        </div>
        <div className="admin-operacion-grid">
          {OPERACIONALES.map(([campo, titulo]) => (
            <div className="admin-operacion-item" key={campo}>
              <span>{titulo}</span><strong>{datos.estadisticas[campo] ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-seccion">
        <div className="card-cabecera">
          <div><h2>Evolución de registros</h2><p>Altas mensuales de clientes y comisionistas en los últimos seis meses.</p></div>
        </div>
        <div className="admin-grafico" role="img" aria-label="Altas mensuales de clientes y comisionistas">
          {datos.registros.map((mes) => (
            <div className="admin-grafico-mes" key={mes.mes}>
              <div className="admin-grafico-barras">
                <span className={`admin-barra clientes${mes.clientes ? '' : ' cero'}`} style={{ height: `${(mes.clientes / maxRegistros) * 100}%` }} title={`${mes.clientes} clientes`} />
                <span className={`admin-barra comisionistas${mes.comisionistas ? '' : ' cero'}`} style={{ height: `${(mes.comisionistas / maxRegistros) * 100}%` }} title={`${mes.comisionistas} comisionistas`} />
              </div>
              <strong>{mesLegible(mes.mes)}</strong>
              <small>Clientes {mes.clientes} · Comisionistas {mes.comisionistas}</small>
            </div>
          ))}
        </div>
        <div className="admin-leyenda"><span className="clientes">Clientes</span><span className="comisionistas">Comisionistas</span></div>
      </section>

      <section className="card admin-seccion">
        <div className="card-cabecera admin-seccion-cabecera">
          <div><h2>Actividad reciente</h2><p>Últimos registros, publicaciones y eventos de verificación.</p></div>
          <Link className="btn" to="/admin/actividad">Ver actividad e historial</Link>
        </div>
        <AdminActivityList items={datos.actividad} />
      </section>
    </section>
  )
}
