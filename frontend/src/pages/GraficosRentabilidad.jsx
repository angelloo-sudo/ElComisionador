import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta } from '../components/ui.jsx'

const DINERO = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const SERIES = [
  { clave: 'ingresos', nombre: 'Ingresos', color: '#3182ce' },
  { clave: 'gastos', nombre: 'Gastos', color: '#d69e2e' },
  { clave: 'resultado', nombre: 'Resultado económico', color: 'resultado' },
]

function hoyLocal() {
  const fecha = new Date()
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

function primerDiaMes(fecha) {
  return `${fecha.slice(0, 7)}-01`
}

function fechaLegible(valor) {
  if (!valor) return '—'
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number)
  return FECHA.format(new Date(Date.UTC(anio, mes - 1, dia)))
}

function textoClasificacion(tipo) {
  return ({ ganancia: 'Ganancia', perdida: 'Pérdida', equilibrio: 'Equilibrio' })[tipo] ?? 'Equilibrio'
}

function formatoCompacto(valor) {
  return new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(valor))
}

function etiquetaPeriodo(fila, agrupacion) {
  if (agrupacion === 'dia') return fechaLegible(fila.periodo)
  if (agrupacion === 'semana') return `Semana ${fechaLegible(fila.periodo_desde)}–${fechaLegible(fila.periodo_hasta)}`
  return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${fila.periodo.slice(0, 10)}T00:00:00Z`))
}

function GraficoBarras({ elementos, etiqueta, titulo }) {
  if (!elementos.length) return <div className="graficos-vacio">No hay datos para representar en este rango.</div>

  const valores = elementos.flatMap((fila) => [Number(fila.ingresos), Number(fila.gastos), Number(fila.resultado)])
  let minimo = Math.min(0, ...valores)
  let maximo = Math.max(0, ...valores)
  if (minimo === maximo) { minimo = -1; maximo = 1 }
  const amplitud = maximo - minimo
  const alto = 330
  const margen = { arriba: 20, abajo: 74, izquierda: 68, derecha: 18 }
  const altoPlano = alto - margen.arriba - margen.abajo
  const anchoGrupo = 112
  const ancho = Math.max(640, margen.izquierda + margen.derecha + anchoGrupo * elementos.length)
  const anchoPlano = ancho - margen.izquierda - margen.derecha
  const y = (valor) => margen.arriba + ((maximo - valor) / amplitud) * altoPlano
  const yCero = y(0)
  const pasos = 4

  return <div className="graficos-svg-scroll" role="region" aria-label={`Gráfico: ${titulo}`} tabIndex="0">
    <svg className="graficos-svg" style={{ width: `max(100%, ${ancho}px)`, maxWidth: 'none' }} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={titulo}>
      {[...Array(pasos + 1)].map((_, indice) => {
        const valor = maximo - (amplitud * indice) / pasos
        const posicion = y(valor)
        return <g key={`eje-${indice}`}>
          <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={posicion} y2={posicion} className={Math.abs(valor) < amplitud / 1000 ? 'graficos-eje-cero' : 'graficos-cuadricula'} />
          <text x={margen.izquierda - 8} y={posicion + 4} textAnchor="end" className="graficos-eje-texto">${formatoCompacto(valor)}</text>
        </g>
      })}
      {elementos.map((fila, indice) => {
        const centro = margen.izquierda + anchoGrupo * indice + anchoGrupo / 2
        const montos = { ingresos: Number(fila.ingresos), gastos: Number(fila.gastos), resultado: Number(fila.resultado) }
        const textoEtiqueta = etiqueta(fila)
        return <g key={fila.id ?? fila.periodo ?? `${fila.fecha}-${indice}`}>
          {SERIES.map((serie, serieIndice) => {
            const valor = montos[serie.clave]
            const yValor = y(valor)
            const altoBarra = Math.max(1, Math.abs(yValor - yCero))
            const color = serie.clave === 'resultado'
              ? valor > 0 ? 'var(--verde-texto)' : valor < 0 ? 'var(--rojo-texto)' : 'var(--texto-2)'
              : serie.color
            const x = centro - 27 + serieIndice * 19
            return <rect key={serie.clave} x={x} y={Math.min(yValor, yCero)} width="15" height={altoBarra} rx="3" fill={color}>
              <title>{`${textoEtiqueta} · ${serie.nombre}: ${DINERO.format(valor)}`}</title>
            </rect>
          })}
          <text x={centro} y={alto - 34} textAnchor="middle" className="graficos-etiqueta">
            {(textoEtiqueta.length > 21 ? `${textoEtiqueta.slice(0, 19)}…` : textoEtiqueta).split('\n').map((linea, lineaIndice) =>
              <tspan key={lineaIndice} x={centro} dy={lineaIndice === 0 ? 0 : 14}>{linea}</tspan>)}
          </text>
        </g>
      })}
    </svg>
  </div>
}

function Leyenda() {
  return <div className="graficos-leyenda" aria-label="Series del gráfico">
    {SERIES.map((serie) => <span key={serie.clave}>
      <i className={serie.clave === 'resultado' ? 'graficos-swatch resultado' : 'graficos-swatch'} style={serie.clave === 'resultado' ? undefined : { background: serie.color }} />
      {serie.nombre}
    </span>)}
  </div>
}

function TablaPeriodos({ periodos, agrupacion }) {
  return <div className="card graficos-tabla-card"><h3>Valores por período</h3>
    {!periodos.length ? <p className="graficos-vacio">No hay movimientos registrados dentro del período.</p> : <div className="tabla-wrap"><table className="tabla">
      <thead><tr><th>Período</th><th className="num">Ingresos</th><th className="num">Gastos</th><th className="num">Resultado económico</th><th>Clasificación</th></tr></thead>
      <tbody>{periodos.map((fila) => <tr key={fila.periodo}>
        <td>{etiquetaPeriodo(fila, agrupacion)}<small className="graficos-subtexto">{fechaLegible(fila.periodo_desde)} – {fechaLegible(fila.periodo_hasta)}</small></td>
        <td className="num">{DINERO.format(Number(fila.total_ingresos))}</td><td className="num">{DINERO.format(Number(fila.total_gastos))}</td>
        <td className="num">{DINERO.format(Number(fila.resultado_economico))}</td><td>{textoClasificacion(fila.clasificacion)}</td>
      </tr>)}</tbody>
    </table></div>}
  </div>
}

function TablaViajes({ viajes }) {
  return <div className="card graficos-tabla-card"><h3>Valores por viaje realizado</h3>
    {!viajes.length ? <p className="graficos-vacio">No hay viajes finalizados dentro del período.</p> : <div className="tabla-wrap"><table className="tabla">
      <thead><tr><th>Viaje</th><th>Origen</th><th>Destino</th><th>Fecha</th><th className="num">Ingresos</th><th className="num">Gastos</th><th className="num">Resultado económico</th><th>Clasificación</th></tr></thead>
      <tbody>{viajes.map((fila) => <tr key={fila.viaje_id}>
        <td>#{fila.viaje_id}</td><td>{fila.origen}</td><td>{fila.destino}</td><td>{fechaLegible(fila.fecha)}</td>
        <td className="num">{DINERO.format(Number(fila.total_ingresos))}</td><td className="num">{DINERO.format(Number(fila.total_gastos))}</td>
        <td className="num">{DINERO.format(Number(fila.resultado_economico))}</td><td>{textoClasificacion(fila.clasificacion)}</td>
      </tr>)}</tbody>
    </table></div>}
  </div>
}

export default function GraficosRentabilidad() {
  const [modo, setModo] = useState('periodo')
  const [agrupacion, setAgrupacion] = useState('mes')
  const [hasta, setHasta] = useState(hoyLocal)
  const [desde, setDesde] = useState(() => primerDiaMes(hoyLocal()))
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const numeroSolicitud = useRef(0)

  useEffect(() => {
    const numero = ++numeroSolicitud.current
    setDatos(null)
    setError('')
    if (!desde || !hasta) {
      setCargando(false)
      return undefined
    }
    if (desde > hasta) {
      setCargando(false)
      setError('La fecha de inicio debe ser anterior o igual a la fecha de fin.')
      return undefined
    }

    setCargando(true)
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ desde, hasta })
      if (modo === 'periodo') params.set('agrupacion', agrupacion)
      try {
        const respuesta = await api.get(`/finanzas/graficos-rentabilidad/${modo === 'periodo' ? 'periodos' : 'viajes'}?${params}`)
        if (numero !== numeroSolicitud.current) return
        setDatos(respuesta)
      } catch (e) {
        if (numero === numeroSolicitud.current) setError(e.message || 'No se pudieron cargar los gráficos.')
      } finally {
        if (numero === numeroSolicitud.current) setCargando(false)
      }
    }, 250)
    return () => { clearTimeout(timer); numeroSolicitud.current += 1 }
  }, [modo, agrupacion, desde, hasta])

  const periodos = (datos?.periodos ?? []).map((fila) => ({
    ...fila,
    ingresos: fila.total_ingresos,
    gastos: fila.total_gastos,
    resultado: fila.resultado_economico,
  }))
  const viajes = (datos?.viajes ?? []).map((fila) => ({
    ...fila,
    ingresos: fila.total_ingresos,
    gastos: fila.total_gastos,
    resultado: fila.resultado_economico,
  }))
  const general = datos?.movimientos_generales

  return <section className="graficos-rentabilidad">
    <header className="cabecera-seccion"><div><h2>Gráficos de rentabilidad</h2><p>Analizá ingresos, gastos y resultados de tus movimientos registrados.</p></div></header>
    <div className="card graficos-controles">
      <div className="pestanas graficos-modalidades" role="tablist" aria-label="Modalidad de rentabilidad">
        <button type="button" role="tab" aria-selected={modo === 'periodo'} className={modo === 'periodo' ? 'activo' : ''} onClick={() => setModo('periodo')}>Por período</button>
        <button type="button" role="tab" aria-selected={modo === 'viaje'} className={modo === 'viaje' ? 'activo' : ''} onClick={() => setModo('viaje')}>Por viaje</button>
      </div>
      <div className="graficos-filtros">
        <label>Fecha de inicio<input type="date" value={desde} max={hasta || undefined} onChange={(evento) => setDesde(evento.target.value)} /></label>
        <label>Fecha de fin<input type="date" value={hasta} min={desde || undefined} onChange={(evento) => setHasta(evento.target.value)} /></label>
        {modo === 'periodo' && <label>Agrupar por<select value={agrupacion} onChange={(evento) => setAgrupacion(evento.target.value)}><option value="dia">Diario</option><option value="semana">Semanal</option><option value="mes">Mensual</option></select></label>}
      </div>
    </div>

    {error && <Alerta tipo="error" titulo="No se pudo actualizar el gráfico">{error}</Alerta>}
    {cargando && <p className="graficos-cargando" role="status">Actualizando datos…</p>}

    {datos && !cargando && !error && (modo === 'periodo'
      ? <>
        <section className="card graficos-card"><div className="graficos-card-titulo"><div><h3>Rentabilidad por período</h3><p>Se muestran los períodos con movimientos; los intervalos vacíos no agregan importes ficticios.</p></div><Leyenda /></div>
          <GraficoBarras elementos={periodos} etiqueta={(fila) => etiquetaPeriodo(fila, agrupacion)} titulo="Ingresos, gastos y resultado por período" />
        </section>
        <TablaPeriodos periodos={datos.periodos} agrupacion={agrupacion} />
      </>
      : <>
        <section className="card graficos-card"><div className="graficos-card-titulo"><div><h3>Rentabilidad por viaje finalizado</h3><p>Los movimientos se asocian solo mediante su viaje_id y su fecha de registro.</p></div><Leyenda /></div>
          <GraficoBarras elementos={viajes} etiqueta={(fila) => `${fila.origen} → ${fila.destino}\n${fechaLegible(fila.fecha)}`} titulo="Ingresos, gastos y resultado por viaje" />
        </section>
        <TablaViajes viajes={datos.viajes} />
        <section className="card graficos-generales"><h3>Movimientos generales sin viaje asociado</h3><p>No se asignan a ningún viaje.</p>
          <dl><div><dt>Ingresos</dt><dd>{DINERO.format(Number(general?.total_ingresos ?? 0))}</dd></div>
            <div><dt>Gastos</dt><dd>{DINERO.format(Number(general?.total_gastos ?? 0))}</dd></div>
            <div><dt>Resultado</dt><dd>{DINERO.format(Number(general?.resultado_economico ?? 0))} · {textoClasificacion(general?.clasificacion)}</dd></div></dl>
        </section>
      </>
    )}
  </section>
}
