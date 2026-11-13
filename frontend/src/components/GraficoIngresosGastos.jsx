import { formatoMoneda } from '../utils/gastos.js'

export default function GraficoIngresosGastos({ ingresos, gastos }) {
  const totalIngresos = Math.max(0, Number(ingresos) || 0)
  const totalGastos = Math.max(0, Number(gastos) || 0)
  const total = totalIngresos + totalGastos
  const porcentajeIngresos = total ? (totalIngresos / total) * 100 : 50
  const fondo = total
    ? `conic-gradient(#3182ce 0 ${porcentajeIngresos}%, #d69e2e ${porcentajeIngresos}% 100%)`
    : 'var(--borde)'

  return (
    <section className="card rentabilidad-grafico" aria-label="Distribución de ingresos y gastos">
      <div>
        <h3>Ingresos y gastos</h3>
        <p>Distribución total del período seleccionado.</p>
        <div className="rentabilidad-grafico-leyenda">
          <span><i className="ingresos" />Ingresos <strong>{formatoMoneda(totalIngresos)}</strong></span>
          <span><i className="gastos" />Gastos <strong>{formatoMoneda(totalGastos)}</strong></span>
        </div>
      </div>
      <div className="rentabilidad-pastel" role="img" aria-label={`Ingresos ${formatoMoneda(totalIngresos)}; gastos ${formatoMoneda(totalGastos)}`} style={{ background: fondo }}>
        <div>{formatoMoneda(total)}</div>
      </div>
    </section>
  )
}
