// Epica 6: US36 (historial) y US37 (detalle).
// Los cobros se registran solos: al llegar el pasajero a destino y al retirarse la encomienda (US35).
// Se muestran solo los ingresos vigentes; ya no se modifican ni se anulan desde la pantalla.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo } from '../components/ui.jsx'
import IngresoDetalleModal from '../components/ingresos/IngresoDetalleModal.jsx'
import { formatoFechaISO, formatoMoneda } from '../utils/gastos.js'

const FILTROS_VACIOS = { desde: '', hasta: '', forma_pago: '', tipo: '', estado: 'activo' }
export const FORMAS = { efectivo: 'Efectivo', transferencia: 'Transferencia' }
export const SERVICIOS = { pasajero: 'Pasajero', encomienda: 'Encomienda' }

export default function Ingresos() {
  const [datos, setDatos] = useState({ ingresos: [], resumen: { cantidad: 0, total: '0.00' } })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS)
  const [errorFiltros, setErrorFiltros] = useState(null)
  const [detalleId, setDetalleId] = useState(null)

  const hayFiltros = Object.entries(aplicados).some(([k, v]) => v && !(k === 'estado' && v === 'activo'))

  const cargar = useCallback((f) => {
    setCargando(true); setError(null)
    const params = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v) })
    return api.get(`/finanzas/ingresos?${params.toString()}`).then(setDatos).catch((e) => setError(e.message)).finally(() => setCargando(false))
  }, [])
  useEffect(() => { cargar(aplicados) }, [cargar, aplicados])

  const cambiar = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value })
  function buscar(e) {
    e.preventDefault()
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) { setErrorFiltros('La fecha "desde" no puede ser posterior a "hasta".'); return }
    setErrorFiltros(null); setAplicados(filtros)
  }
  function limpiar() { setErrorFiltros(null); setFiltros(FILTROS_VACIOS); setAplicados(FILTROS_VACIOS) }

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Mis ingresos</h2>
          <p>Los cobros se registran solos cuando el pasajero llega a destino y cuando retirás una encomienda.</p>
        </div>
      </div>

      <form className="card filtros-gastos" onSubmit={buscar}>
        <Campo label="Desde" icono="calendar"><input type="date" name="desde" value={filtros.desde} onChange={cambiar} /></Campo>
        <Campo label="Hasta" icono="calendar"><input type="date" name="hasta" value={filtros.hasta} onChange={cambiar} /></Campo>
        <Campo label="Forma de pago">
          <select name="forma_pago" value={filtros.forma_pago} onChange={cambiar}>
            <option value="">Todas</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
          </select><Icon nombre="down" />
        </Campo>
        <Campo label="Concepto de viaje">
          <select name="tipo" value={filtros.tipo} onChange={cambiar}>
            <option value="">Todos</option><option value="pasajero">Pasajeros</option><option value="encomienda">Encomiendas</option>
          </select><Icon nombre="down" />
        </Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltros && <button type="button" className="btn" onClick={limpiar}>Limpiar</button>}
        </div>
      </form>

      {errorFiltros && <Alerta tipo="error" titulo="Revisá los filtros">{errorFiltros}</Alerta>}
      {error && <Alerta tipo="error" titulo="No se pudieron cargar los ingresos">{error}</Alerta>}

      <div className="gastos-resumen" aria-live="polite">
        <div><span>Total de ingresos</span><strong>{formatoMoneda(datos.resumen.total)}</strong></div>
        <div><span>Cantidad de cobros</span><strong>{datos.resumen.cantidad}</strong></div>
      </div>

      <div className="card tabla-wrap">
        {cargando ? <p className="vacio">Cargando ingresos...</p> : datos.ingresos.length === 0 ? (
          <p className="vacio">No se encontraron ingresos registrados</p>
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Cliente</th><th>Pago</th><th className="num">Monto</th><th></th></tr></thead>
            <tbody>
              {datos.ingresos.map((i) => (
                <tr key={i.id}>
                  <td>{formatoFechaISO(i.fecha)}</td>
                  <td>{i.concepto}</td>
                  <td>{i.cliente || '-'}</td>
                  <td>{FORMAS[i.forma_pago] ?? '-'}</td>
                  <td className="num">{formatoMoneda(i.monto)}</td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="btn btn-chico" onClick={() => setDetalleId(i.id)}>Ver detalle</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalleId && <IngresoDetalleModal id={detalleId} onClose={() => setDetalleId(null)} />}
    </section>
  )
}
