import { jsPDF } from 'jspdf'
import { formatoFechaISO } from './gastos.js'

const PESOS = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dinero = (valor) => `$ ${PESOS.format(Number(valor))}`

export function crearDocumentoReporte(reporte) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 15
  const anchoUtil = ancho - margen * 2
  let y = 18

  const pagina = () => {
    doc.addPage()
    y = 18
  }
  const asegurarEspacio = (altoNecesario, alCortar = null) => {
    if (y + altoNecesario > alto - 16) {
      pagina()
      alCortar?.()
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(75, 13, 28)
  doc.text('ComiTrack', margen, y)
  y += 10
  doc.setTextColor(25, 25, 28)
  doc.setFontSize(20)
  doc.text('Reporte de rentabilidad', margen, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 96)
  doc.text(`Comisionista: ${reporte.comisionista || '—'}`, margen, y)
  y += 6
  doc.text(`Período: ${formatoFechaISO(reporte.periodo.desde)} al ${formatoFechaISO(reporte.periodo.hasta)}`, margen, y)
  y += 6
  doc.text(`Generado: ${new Date(reporte.generado_en).toLocaleString('es-AR')}`, margen, y)
  y += 11

  const resumen = [
    ['Ingresos', reporte.total_ingresos],
    ['Gastos', reporte.total_gastos],
    ['Resultado', reporte.resultado_economico],
  ]
  const gap = 4
  const cardW = (anchoUtil - gap * 2) / 3
  resumen.forEach(([titulo, monto], i) => {
    const x = margen + i * (cardW + gap)
    doc.setDrawColor(220, 220, 224)
    doc.setFillColor(248, 248, 249)
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(95, 95, 101)
    doc.text(titulo, x + 4, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 34)
    doc.text(dinero(monto), x + 4, y + 15)
    doc.setFont('helvetica', 'normal')
  })
  y += 29

  const dibujarCabeceraTabla = (titulo) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(28, 28, 32)
    doc.text(titulo, margen, y)
    y += 6
    doc.setFillColor(75, 13, 28)
    doc.rect(margen, y, anchoUtil, 8, 'F')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('Fecha', margen + 2, y + 5.5)
    doc.text('Concepto', margen + 28, y + 5.5)
    doc.text('Trayecto', margen + 93, y + 5.5)
    doc.text('Monto', ancho - margen - 2, y + 5.5, { align: 'right' })
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(42, 42, 46)
  }

  const tabla = (titulo, filas, { conDescripcion = false } = {}) => {
    asegurarEspacio(17)
    dibujarCabeceraTabla(titulo)
    if (!filas.length) {
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 105)
      doc.text('Sin movimientos en el período.', margen + 2, y + 6)
      y += 12
      return
    }
    filas.forEach((fila) => {
      const concepto = conDescripcion && fila.descripcion
        ? `${fila.concepto} — ${fila.descripcion}`
        : fila.concepto
      doc.setFontSize(8.5)
      const lineasConcepto = doc.splitTextToSize(String(concepto || 'Sin concepto'), 61)
      const textoTrayecto = fila.trayecto
        ? `${fila.trayecto.origen} → ${fila.trayecto.destino} · ${formatoFechaISO(fila.trayecto.fecha)}`
        : 'Movimiento general'
      const lineasTrayecto = doc.splitTextToSize(textoTrayecto, 54)
      const altoFila = Math.max(8, Math.max(lineasConcepto.length, lineasTrayecto.length) * 4.2 + 3)
      asegurarEspacio(altoFila + 1, () => dibujarCabeceraTabla(`${titulo} (continuación)`))
      doc.setDrawColor(225, 225, 228)
      doc.line(margen, y + altoFila, ancho - margen, y + altoFila)
      doc.text(formatoFechaISO(fila.fecha), margen + 2, y + 5.5)
      doc.text(lineasConcepto, margen + 28, y + 5.5)
      doc.text(lineasTrayecto, margen + 93, y + 5.5)
      doc.text(dinero(fila.monto), ancho - margen - 2, y + 5.5, { align: 'right' })
      y += altoFila
    })
    y += 9
  }

  tabla('Detalle de ingresos', reporte.ingresos)
  tabla('Detalle de gastos', reporte.gastos, { conDescripcion: true })

  if (reporte.trayectos?.length) {
    const cabeceraTrayectos = () => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(28, 28, 32)
      doc.text('Resultado por trayecto', margen, y)
      y += 6
      doc.setFillColor(75, 13, 28)
      doc.rect(margen, y, anchoUtil, 8, 'F')
      doc.setFontSize(7.5)
      doc.setTextColor(255, 255, 255)
      doc.text('Trayecto', margen + 2, y + 5.5)
      doc.text('Fecha', margen + 76, y + 5.5)
      doc.text('Ingresos', margen + 110, y + 5.5, { align: 'right' })
      doc.text('Gastos', margen + 142, y + 5.5, { align: 'right' })
      doc.text('Resultado', ancho - margen - 2, y + 5.5, { align: 'right' })
      y += 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(42, 42, 46)
    }
    asegurarEspacio(17)
    cabeceraTrayectos()
    for (const viaje of reporte.trayectos) {
      asegurarEspacio(11, cabeceraTrayectos)
      doc.setDrawColor(225, 225, 228)
      doc.line(margen, y + 8, ancho - margen, y + 8)
      doc.setFontSize(7.5)
      doc.text(doc.splitTextToSize(`${viaje.origen} → ${viaje.destino}`, 70), margen + 2, y + 5.5)
      doc.text(formatoFechaISO(viaje.fecha), margen + 76, y + 5.5)
      doc.text(dinero(viaje.total_ingresos), margen + 110, y + 5.5, { align: 'right' })
      doc.text(dinero(viaje.total_gastos), margen + 142, y + 5.5, { align: 'right' })
      doc.text(dinero(viaje.resultado_economico), ancho - margen - 2, y + 5.5, { align: 'right' })
      y += 9
    }
    y += 6
  }

  if (reporte.movimientos_generales) {
    asegurarEspacio(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(28, 28, 32)
    doc.text('Movimientos generales', margen, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(80, 80, 85)
    doc.text(`Ingresos: ${dinero(reporte.movimientos_generales.total_ingresos)}`, margen, y)
    doc.text(`Gastos: ${dinero(reporte.movimientos_generales.total_gastos)}`, margen + 62, y)
    doc.text(`Resultado: ${dinero(reporte.movimientos_generales.resultado_economico)}`, margen + 125, y)
    y += 9
  }

  asegurarEspacio(22)
  doc.setFillColor(75, 13, 28)
  doc.roundedRect(margen, y, anchoUtil, 17, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('Resultado económico final', margen + 4, y + 7)
  doc.text(dinero(reporte.resultado_economico), ancho - margen - 4, y + 7, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Documento generado por ComiTrack', margen + 4, y + 13)
  return doc
}

export function descargarReportePdf(reporte) {
  crearDocumentoReporte(reporte).save(`reporte_rentabilidad_${reporte.periodo.desde}_${reporte.periodo.hasta}.pdf`)
}
