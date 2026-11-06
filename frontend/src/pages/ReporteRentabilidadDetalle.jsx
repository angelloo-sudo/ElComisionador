import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { formatoFechaISO, formatoMoneda } from '../utils/gastos.js'

function tablaMovimientos(titulo, filas, tipo, total) {
  return <article className="card rentabilidad-tabla-card">
    <header className="card-cabecera"><div><h3>{titulo}</h3><p>{filas.length} movimiento{filas.length === 1 ? '' : 's'}</p></div></header>
    {!filas.length ? <p className="vacio rentabilidad-vacio">Sin movimientos.</p> : <div className="tabla-wrap"><table className="tabla">
      <thead><tr><th>Fecha</th><th>Concepto</th>{tipo === 'gastos' && <th>Descripción</th>}<th>Trayecto asociado</th><th className="num">Monto</th></tr></thead>
      <tbody>{filas.map((m) => <tr key={`${tipo}-${m.id}`}>
        <td>{formatoFechaISO(m.fecha)}</td><td>{m.concepto || 'Sin concepto'}</td>{tipo === 'gastos' && <td>{m.descripcion || '—'}</td>}
        <td>{m.trayecto ? `${m.trayecto.origen} → ${m.trayecto.destino} · ${formatoFechaISO(m.trayecto.fecha)}` : 'Movimiento general'}</td>
        <td className="num">{formatoMoneda(m.monto)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th colSpan={tipo === 'gastos' ? 4 : 3}>Total de {tipo}</th><th className="num">{formatoMoneda(total)}</th></tr></tfoot>
    </table></div>}
  </article>
}

const TEXTO_CLASIFICACION = { rentable: 'Rentable', perdida: 'Pérdida', equilibrado: 'Equilibrado' }

export default function ReporteRentabilidadDetalle() {
  const { id } = useParams()
  const [reporte, setReporte] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoPdf, setCargandoPdf] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => {
    let vigente = true
    setCargando(true)
    api.get(`/finanzas/reportes-rentabilidad/${id}`)
      .then((r) => { if (vigente) setReporte(r) })
      .catch((e) => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [id])

  async function descargarPdf() {
    setCargandoPdf(true)
    try {
      const { descargarReportePdf } = await import('../utils/reporteRentabilidadPdf.js')
      descargarReportePdf(reporte)
    } catch { setError('No se pudo preparar el PDF histórico. Volvé a intentarlo.') }
    finally { setCargandoPdf(false) }
  }

  if (cargando) return <p className="vacio" role="status">Cargando reporte…</p>
  if (error) return <section><Alerta tipo="error" titulo="No se pudo abrir el reporte">{error}</Alerta><Link className="btn" to="/reportes-rentabilidad">Volver al listado</Link></section>
  const balance = Number(reporte.resultado_economico)
  return <section className="reporte-rentabilidad">
    <div className="barra-pagina">
      <div><h2>Reporte #{reporte.id}</h2><p>Emitido el {new Date(reporte.generado_en).toLocaleString('es-AR')}</p></div>
      <Link className="btn" to="/reportes-rentabilidad"><Icon nombre="arrow" />Volver al listado</Link>
    </div>
    <section className="card rentabilidad-resumen">
      <div className="rentabilidad-resumen-cabecera"><div><h3>{reporte.comisionista || 'Comisionista'}</h3><p>Período {formatoFechaISO(reporte.periodo.desde)} – {formatoFechaISO(reporte.periodo.hasta)}</p></div>
        <span className={`rentabilidad-estado ${balance > 0 ? 'positivo' : balance < 0 ? 'negativo' : 'neutro'}`}>{balance > 0 ? 'Ganancia' : balance < 0 ? 'Pérdida' : 'Equilibrado'}</span>
      </div>
      <div className="rentabilidad-kpis"><div><span>Total de ingresos</span><strong>{formatoMoneda(reporte.total_ingresos)}</strong></div><div><span>Total de gastos</span><strong>{formatoMoneda(reporte.total_gastos)}</strong></div><div className="rentabilidad-resultado"><span>Resultado económico</span><strong>{formatoMoneda(reporte.resultado_economico)}</strong></div></div>
      <div className="rentabilidad-acciones"><button type="button" className="btn btn-primario" onClick={descargarPdf} disabled={cargandoPdf}><Icon nombre="download" />{cargandoPdf ? 'Preparando PDF…' : 'Descargar PDF'}</button></div>
    </section>
    {reporte.demo && <Alerta tipo="aviso" titulo="Reporte de demostración">Los importes y trayectos de este reporte son ficticios; no corresponden a movimientos económicos registrados.</Alerta>}
    <div className="rentabilidad-detalles">
      {tablaMovimientos('Ingresos incluidos', reporte.ingresos, 'ingresos', reporte.total_ingresos)}
      {tablaMovimientos('Gastos incluidos', reporte.gastos, 'gastos', reporte.total_gastos)}
    </div>
    <section className="card rentabilidad-generales">
      <div className="card-cabecera"><div><h3>Movimientos generales</h3><p>No asociados a un viaje; se mantienen fuera del cálculo por trayecto.</p></div></div>
      <div className="rentabilidad-viaje-valores">
        <span>Ingresos generales<strong>{formatoMoneda(reporte.movimientos_generales.total_ingresos)}</strong></span>
        <span>Gastos generales<strong>{formatoMoneda(reporte.movimientos_generales.total_gastos)}</strong></span>
        <span>Resultado general<strong>{formatoMoneda(reporte.movimientos_generales.resultado_economico)}</strong></span>
      </div>
      <p className="rentabilidad-general-cantidad">{reporte.movimientos_generales.ingresos.length} ingreso{reporte.movimientos_generales.ingresos.length === 1 ? '' : 's'} y {reporte.movimientos_generales.gastos.length} gasto{reporte.movimientos_generales.gastos.length === 1 ? '' : 's'} general{reporte.movimientos_generales.gastos.length === 1 ? '' : 'es'}</p>
    </section>
    <section className="rentabilidad-viajes">
      <div className="barra-pagina"><div><h3>Resultado por trayecto</h3><p>Los movimientos generales no se distribuyen entre viajes.</p></div></div>
      {!reporte.trayectos.length ? <p className="vacio">Este reporte no contiene movimientos asociados a trayectos.</p> : <div className="rentabilidad-viajes-grilla">{reporte.trayectos.map((v) => <article className="card rentabilidad-viaje" key={v.id}>
        <div className="rentabilidad-viaje-titulo"><div><strong>{v.origen} → {v.destino}</strong><span>Viaje #{v.id} · {formatoFechaISO(v.fecha)}</span></div><span className={`rentabilidad-estado ${v.clasificacion === 'rentable' ? 'positivo' : v.clasificacion === 'perdida' ? 'negativo' : 'neutro'}`}>{TEXTO_CLASIFICACION[v.clasificacion]}</span></div>
        <div className="rentabilidad-viaje-valores"><span>Ingresos<strong>{formatoMoneda(v.total_ingresos)}</strong></span><span>Gastos<strong>{formatoMoneda(v.total_gastos)}</strong></span><span>Resultado<strong>{formatoMoneda(v.resultado_economico)}</strong></span></div>
      </article>)}</div>}
    </section>
  </section>
}
