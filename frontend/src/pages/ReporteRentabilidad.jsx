import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta, Campo } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import GraficoIngresosGastos from '../components/GraficoIngresosGastos.jsx'
import { formatoFechaISO, formatoMoneda } from '../utils/gastos.js'

function movimientoTabla(titulo, movimientos, tipo, total) {
  return (
    <article className="card rentabilidad-tabla-card">
      <header className="card-cabecera"><div><h3>{titulo}</h3><p>{movimientos.length} movimiento{movimientos.length === 1 ? '' : 's'}</p></div></header>
      {movimientos.length === 0 ? <p className="vacio rentabilidad-vacio">Sin movimientos en el período.</p> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th>{tipo === 'gastos' && <th>Descripción</th>}<th className="num">Monto</th></tr></thead>
            <tbody>{movimientos.map((m) => (
              <tr key={m.id}><td>{formatoFechaISO(m.fecha)}</td><td>{m.concepto || 'Sin concepto'}</td>{tipo === 'gastos' && <td>{m.descripcion || '—'}</td>}<td className="num">{formatoMoneda(m.monto)}</td></tr>
            ))}</tbody>
            <tfoot><tr><th colSpan={tipo === 'gastos' ? 3 : 2}>Total de {tipo}</th><th className="num">{formatoMoneda(total)}</th></tr></tfoot>
          </table>
        </div>
      )}
      {movimientos.length === 0 && <div className="rentabilidad-total-vacio"><strong>Total de {tipo}</strong><strong>{formatoMoneda(total)}</strong></div>}
    </article>
  )
}

export default function ReporteRentabilidad() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [reporte, setReporte] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoPdf, setCargandoPdf] = useState(false)
  const [error, setError] = useState(null)

  async function generar(e) {
    e.preventDefault()
    setError(null)
    setReporte(null)
    if (!desde || !hasta) { setError('Seleccioná una fecha de inicio y una fecha de fin.'); return }
    if (desde > hasta) { setError('La fecha de inicio no puede ser posterior a la fecha de fin.'); return }
    setCargando(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      setReporte(await api.get(`/finanzas/rentabilidad?${params}`))
    } catch (e2) {
      setError(e2.message || 'No se pudo generar el reporte.')
    } finally { setCargando(false) }
  }

  async function descargarPdf() {
    setCargandoPdf(true)
    try {
      const { descargarReportePdf } = await import('../utils/reporteRentabilidadPdf.js')
      descargarReportePdf(reporte)
    } catch {
      setError('No se pudo preparar el PDF. Volvé a intentarlo.')
    } finally { setCargandoPdf(false) }
  }

  const balance = Number(reporte?.resultado_economico ?? 0)
  const estadoBalance = balance > 0 ? 'Ganancia' : balance < 0 ? 'Pérdida' : 'Equilibrado'

  return (
    <section className="reporte-rentabilidad">
      <div className="barra-pagina">
        <div><h2>Reporte de rentabilidad</h2><p>Consultá el balance de tus ingresos y gastos para un período.</p></div>
        <Link className="btn" to="/reportes-rentabilidad">Ver reportes guardados</Link>
      </div>
      <form className="card filtros-gastos rentabilidad-filtros" onSubmit={generar}>
        <Campo label="Fecha de inicio" icono="calendar"><input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setReporte(null); setError(null) }} required /></Campo>
        <Campo label="Fecha de fin" icono="calendar"><input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setReporte(null); setError(null) }} required /></Campo>
        <button className="btn btn-primario" type="submit" disabled={cargando}><Icon nombre="search" />{cargando ? 'Generando…' : 'Generar reporte'}</button>
      </form>

      {error && <Alerta tipo="error" titulo="No se pudo generar el reporte">{error}</Alerta>}
      {cargando && <p className="vacio" role="status">Consultando movimientos…</p>}

      {reporte && !cargando && <>
        <section className="card rentabilidad-resumen" aria-label="Resumen económico">
          <div className="rentabilidad-resumen-cabecera">
            <div><h3>Período {formatoFechaISO(reporte.periodo.desde)} – {formatoFechaISO(reporte.periodo.hasta)}</h3><p>Generado el {new Date(reporte.generado_en).toLocaleString('es-AR')}</p></div>
            <span className={`rentabilidad-estado ${balance > 0 ? 'positivo' : balance < 0 ? 'negativo' : 'neutro'}`}>{estadoBalance}</span>
          </div>
          <div className="rentabilidad-kpis">
            <div><span>Total de ingresos</span><strong>{formatoMoneda(reporte.total_ingresos)}</strong></div>
            <div><span>Total de gastos</span><strong>{formatoMoneda(reporte.total_gastos)}</strong></div>
            <div className="rentabilidad-resultado"><span>Resultado económico</span><strong>{formatoMoneda(reporte.resultado_economico)}</strong></div>
          </div>
          <div className="rentabilidad-acciones">
            {reporte.id && <Link className="btn" to={`/reportes-rentabilidad/${reporte.id}`}>Abrir reporte guardado</Link>}
            {reporte.id && <Link className="btn" to="/reportes-rentabilidad">Historial</Link>}
            <button type="button" className="btn btn-primario" onClick={descargarPdf} disabled={cargandoPdf}><Icon nombre="download" />{cargandoPdf ? 'Preparando PDF…' : 'Descargar PDF'}</button>
          </div>
        </section>
        {reporte.cantidad_movimientos === 0 && <Alerta tipo="aviso" titulo="No se encontraron movimientos">Se muestra el balance en cero para las fechas seleccionadas.</Alerta>}
        <GraficoIngresosGastos ingresos={reporte.total_ingresos} gastos={reporte.total_gastos} />
        <div className="rentabilidad-detalles">
          {movimientoTabla('Detalle de ingresos', reporte.ingresos, 'ingresos', reporte.total_ingresos)}
          {movimientoTabla('Detalle de gastos', reporte.gastos, 'gastos', reporte.total_gastos)}
        </div>
      </>}
    </section>
  )
}
