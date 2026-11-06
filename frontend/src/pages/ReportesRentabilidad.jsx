import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { Alerta } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { formatoFechaISO, formatoMoneda } from '../utils/gastos.js'
import { validarRangoReportesRentabilidad } from '../utils/filtrosReportesRentabilidad.js'

const LIMITE = 20
const FILTROS_VACIOS = { fechaInicio: '', fechaFin: '' }

export default function ReportesRentabilidad() {
  const [datos, setDatos] = useState({ reportes: [], paginacion: { total: 0 } })
  const [filtrosBorrador, setFiltrosBorrador] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(null)
  const [errorFiltro, setErrorFiltro] = useState('')
  const [offset, setOffset] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    setDatos({ reportes: [], paginacion: { total: 0 } })
    setCargando(true)
    setError(null)
    const parametros = new URLSearchParams({ limite: String(LIMITE), offset: String(offset) })
    if (filtrosAplicados) {
      parametros.set('fechaInicio', filtrosAplicados.fechaInicio)
      parametros.set('fechaFin', filtrosAplicados.fechaFin)
    }
    api.get(`/finanzas/reportes-rentabilidad?${parametros}`)
      .then((respuesta) => { if (vigente) setDatos(respuesta) })
      .catch((e) => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [offset, filtrosAplicados])

  function actualizarFiltro(evento) {
    setFiltrosBorrador((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }))
    setErrorFiltro('')
  }

  function aplicarFiltros(evento) {
    evento.preventDefault()
    const mensaje = validarRangoReportesRentabilidad(filtrosBorrador.fechaInicio, filtrosBorrador.fechaFin)
    if (mensaje) {
      setErrorFiltro(mensaje)
      return
    }
    setErrorFiltro('')
    setOffset(0)
    setFiltrosAplicados(filtrosBorrador.fechaInicio
      ? { ...filtrosBorrador }
      : null)
  }

  function limpiarFiltros() {
    setFiltrosBorrador(FILTROS_VACIOS)
    setErrorFiltro('')
    setOffset(0)
    setFiltrosAplicados(null)
  }

  const total = datos.paginacion.total ?? 0
  const hayFiltroAplicado = filtrosAplicados !== null
  return (
    <section className="reportes-rentabilidad">
      <div className="barra-pagina">
        <div><h2>Reportes generados</h2><p>Consultá las emisiones guardadas con sus valores originales.</p></div>
        <Link className="btn btn-primario" to="/rentabilidad"><Icon nombre="plus" />Generar reporte</Link>
      </div>

      <form className="card filtros-gastos reportes-filtros" onSubmit={aplicarFiltros} noValidate>
        <label>Fecha de inicio<input type="date" name="fechaInicio" value={filtrosBorrador.fechaInicio} onChange={actualizarFiltro} aria-invalid={Boolean(errorFiltro)} /></label>
        <label>Fecha de fin<input type="date" name="fechaFin" value={filtrosBorrador.fechaFin} onChange={actualizarFiltro} aria-invalid={Boolean(errorFiltro)} /></label>
        <div className="acciones">
          <button className="btn btn-primario" type="submit" disabled={cargando}>Filtrar</button>
          <button className="btn" type="button" onClick={limpiarFiltros} disabled={cargando && !hayFiltroAplicado}>Limpiar filtros</button>
        </div>
      </form>
      {errorFiltro && <Alerta tipo="error" titulo="Revisá el período seleccionado">{errorFiltro}</Alerta>}
      {error && <Alerta tipo="error" titulo="No se pudieron cargar los reportes">{error}</Alerta>}

      {cargando ? <p className="vacio" role="status">Cargando reportes…</p> : !error && datos.reportes.length === 0 ? (
        hayFiltroAplicado ? (
          <div className="card reportes-sin-datos"><Icon nombre="wallet" tamano={30} /><h3>No se encontraron reportes para el período seleccionado</h3>
            <p>Probá con otro rango de fechas o limpiá los filtros para volver a consultar todos tus reportes.</p>
            <button className="btn btn-primario" type="button" onClick={limpiarFiltros}>Limpiar filtros</button>
          </div>
        ) : (
          <div className="card reportes-sin-datos"><Icon nombre="wallet" tamano={30} /><h3>Todavía no generaste reportes</h3><p>Cuando emitas un reporte, vas a poder volver a consultar sus datos desde acá.</p><Link className="btn btn-primario" to="/rentabilidad">Generar primer reporte</Link></div>
        )
      ) : !error && <>
        <div className="card tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Período</th><th>Generado</th><th>Ingresos</th><th>Gastos</th><th>Resultado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{datos.reportes.map((r) => {
              const resultado = Number(r.resultado_economico)
              return <tr key={r.id}>
                <td>{formatoFechaISO(r.periodo_desde)} – {formatoFechaISO(r.periodo_hasta)}{r.demo && <span className="badge-demo">Datos ficticios</span>}</td>
                <td>{new Date(r.generado_en).toLocaleString('es-AR')}</td>
                <td>{formatoMoneda(r.total_ingresos)}</td>
                <td>{formatoMoneda(r.total_gastos)}</td>
                <td><span className={`rentabilidad-estado ${resultado > 0 ? 'positivo' : resultado < 0 ? 'negativo' : 'neutro'}`}>{formatoMoneda(r.resultado_economico)}</span></td>
                <td><Link className="btn btn-secundario btn-compacto" to={`/reportes-rentabilidad/${r.id}`}>Ver detalle <Icon nombre="arrow" /></Link></td>
              </tr>
            })}</tbody>
          </table>
        </div>
        <div className="reportes-paginacion"><span>{total ? `${offset + 1}–${Math.min(offset + LIMITE, total)} de ${total}` : '0 reportes'}</span><div>
          <button className="btn" type="button" disabled={offset === 0 || cargando} onClick={() => setOffset(Math.max(0, offset - LIMITE))}>Anterior</button>
          <button className="btn" type="button" disabled={offset + LIMITE >= total || cargando} onClick={() => setOffset(offset + LIMITE)}>Siguiente</button>
        </div></div>
      </>}
    </section>
  )
}
