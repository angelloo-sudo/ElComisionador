import { jsPDF } from 'jspdf'
import { formatoFechaISO } from './gastos.js'

const PESOS = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dinero = (valor) => `$ ${PESOS.format(Number(valor))}`

// Paleta de ComiTrack (tema café/tinto de la aplicación).
const COLOR = {
  tinto: [140, 28, 52],
  cafe: [58, 35, 24],
  texto: [43, 33, 28],
  suave: [120, 98, 86],
  linea: [232, 221, 211],
  fondoCabecera: [244, 235, 227],
  cebra: [251, 247, 243],
  verde: [47, 125, 79],
  verdeFondo: [230, 243, 234],
  rojo: [192, 57, 43],
  rojoFondo: [253, 235, 232],
  blanco: [255, 255, 255],
}

// recursos (opcional): { fuentes: { regular, bold } en base64, logo: data URL PNG }.
// Sin recursos (por ejemplo en los tests de Node) se usa Helvetica y no se dibuja el canguro.
export function crearDocumentoReporte(reporte, recursos = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 16
  const anchoUtil = ancho - margen * 2
  const pieY = alto - 12
  let y = 0

  let familia = 'helvetica'
  if (recursos.fuentes?.regular && recursos.fuentes?.bold) {
    doc.addFileToVFS('Inter-Regular.ttf', recursos.fuentes.regular)
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
    doc.addFileToVFS('Inter-Bold.ttf', recursos.fuentes.bold)
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')
    familia = 'Inter'
  }
  // Helvetica (fuente estándar del PDF) no tiene la flecha: se reemplaza para no ver símbolos raros.
  const t = (texto) => (familia === 'Inter' ? String(texto) : String(texto).replaceAll('→', '>'))
  const fuente = (estilo, tamano, color = COLOR.texto) => {
    doc.setFont(familia, estilo)
    doc.setFontSize(tamano)
    doc.setTextColor(...color)
  }

  // ---------- Cabecera ----------
  doc.setFillColor(...COLOR.tinto)
  doc.rect(0, 0, ancho, 4, 'F')
  y = 16
  const anchoLogo = 24
  const altoLogo = recursos.logo ? anchoLogo * 1.098 : 0
  if (recursos.logo) doc.addImage(recursos.logo, 'PNG', ancho - margen - anchoLogo, 9, anchoLogo, altoLogo)

  fuente('bold', 11, COLOR.tinto)
  doc.text('ComiTrack', margen, y)
  y += 9
  fuente('bold', 21, COLOR.cafe)
  doc.text('Reporte de rentabilidad', margen, y)
  y += 8
  const datosCabecera = [
    ['Comisionista', reporte.comisionista || '—'],
    ['Período', `${formatoFechaISO(reporte.periodo.desde)} al ${formatoFechaISO(reporte.periodo.hasta)}`],
    ['Generado', new Date(reporte.generado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })],
  ]
  datosCabecera.forEach(([etiqueta, valor]) => {
    fuente('normal', 9.5, COLOR.suave)
    doc.text(`${etiqueta}:`, margen, y)
    fuente('bold', 9.5, COLOR.texto)
    doc.text(t(valor), margen + 26, y)
    y += 5.5
  })
  y = Math.max(y + 4, 9 + altoLogo + 5)
  doc.setDrawColor(...COLOR.linea)
  doc.setLineWidth(0.3)
  doc.line(margen, y, ancho - margen, y)
  y += 8

  // ---------- Resumen ----------
  const resultado = Number(reporte.resultado_economico)
  const tarjetas = [
    { titulo: 'TOTAL DE INGRESOS', monto: reporte.total_ingresos, color: COLOR.verde, fondo: COLOR.verdeFondo },
    { titulo: 'TOTAL DE GASTOS', monto: reporte.total_gastos, color: COLOR.rojo, fondo: COLOR.rojoFondo },
    { titulo: 'RESULTADO ECONÓMICO', monto: reporte.resultado_economico, color: COLOR.blanco, fondo: resultado < 0 ? COLOR.rojo : COLOR.tinto, etiqueta: resultado > 0 ? 'Ganancia' : resultado < 0 ? 'Pérdida' : 'Equilibrado' },
  ]
  const separacion = 5
  const anchoTarjeta = (anchoUtil - separacion * 2) / 3
  tarjetas.forEach((tarjeta, i) => {
    const x = margen + i * (anchoTarjeta + separacion)
    doc.setFillColor(...tarjeta.fondo)
    doc.roundedRect(x, y, anchoTarjeta, 24, 2.5, 2.5, 'F')
    const claro = tarjeta.color === COLOR.blanco
    fuente('bold', 7.5, claro ? COLOR.blanco : COLOR.suave)
    doc.text(tarjeta.titulo, x + 5, y + 8)
    fuente('bold', 13.5, tarjeta.color)
    doc.text(dinero(tarjeta.monto), x + 5, y + 16.5)
    if (tarjeta.etiqueta) {
      fuente('normal', 8, COLOR.blanco)
      doc.text(tarjeta.etiqueta, x + 5, y + 21)
    }
  })
  y += 34

  // ---------- Tablas ----------
  const columnas = { fecha: margen + 3, concepto: margen + 27, viaje: margen + 101, monto: ancho - margen - 3 }
  const anchoConcepto = 70
  const anchoViaje = 50

  const nuevaPagina = () => {
    doc.addPage()
    doc.setFillColor(...COLOR.tinto)
    doc.rect(0, 0, ancho, 4, 'F')
    y = 18
  }
  const asegurarEspacio = (necesario, alCortar) => {
    if (y + necesario > pieY - 6) {
      nuevaPagina()
      alCortar?.()
    }
  }

  const cabeceraTabla = (titulo) => {
    fuente('bold', 12.5, COLOR.cafe)
    doc.text(titulo, margen, y)
    y += 4
    doc.setFillColor(...COLOR.fondoCabecera)
    doc.roundedRect(margen, y, anchoUtil, 8.5, 1.5, 1.5, 'F')
    fuente('bold', 8, COLOR.cafe)
    doc.text('FECHA', columnas.fecha, y + 5.6)
    doc.text('CONCEPTO', columnas.concepto, y + 5.6)
    doc.text('VIAJE ASOCIADO', columnas.viaje, y + 5.6)
    doc.text('MONTO', columnas.monto, y + 5.6, { align: 'right' })
    y += 8.5
  }

  const tabla = (titulo, filas, total, { conDescripcion = false, colorTotal } = {}) => {
    asegurarEspacio(26)
    cabeceraTabla(titulo)
    if (!filas.length) {
      fuente('normal', 9, COLOR.suave)
      doc.text('Sin movimientos en el período.', columnas.fecha, y + 6.5)
      y += 10
    }
    filas.forEach((fila, indice) => {
      const concepto = conDescripcion && fila.descripcion ? `${fila.concepto || 'Sin concepto'} — ${fila.descripcion}` : (fila.concepto || 'Sin concepto')
      const trayecto = fila.trayecto
        ? `${fila.trayecto.origen} → ${fila.trayecto.destino} · ${formatoFechaISO(fila.trayecto.fecha)}`
        : 'Sin viaje asociado'
      fuente('normal', 9)
      const lineasConcepto = doc.splitTextToSize(t(concepto), anchoConcepto)
      fuente('normal', 8.5)
      const lineasViaje = doc.splitTextToSize(t(trayecto), anchoViaje)
      const altoFila = Math.max(lineasConcepto.length, lineasViaje.length) * 4.3 + 4.4
      asegurarEspacio(altoFila, () => cabeceraTabla(`${titulo} (continuación)`))
      if (indice % 2 === 1) {
        doc.setFillColor(...COLOR.cebra)
        doc.rect(margen, y, anchoUtil, altoFila, 'F')
      }
      const base = y + 5.4
      fuente('normal', 9, COLOR.suave)
      doc.text(formatoFechaISO(fila.fecha), columnas.fecha, base)
      fuente('normal', 9, COLOR.texto)
      doc.text(lineasConcepto, columnas.concepto, base, { lineHeightFactor: 1.35 })
      fuente('normal', 8.5, fila.trayecto ? COLOR.texto : COLOR.suave)
      doc.text(lineasViaje, columnas.viaje, base, { lineHeightFactor: 1.35 })
      fuente('bold', 9, COLOR.texto)
      doc.text(dinero(fila.monto), columnas.monto, base, { align: 'right' })
      y += altoFila
      doc.setDrawColor(...COLOR.linea)
      doc.setLineWidth(0.2)
      doc.line(margen, y, ancho - margen, y)
    })
    // Total de la tabla
    asegurarEspacio(10)
    fuente('bold', 9.5, COLOR.cafe)
    doc.text(`Total de ${titulo.toLowerCase().replace('detalle de ', '')}`, columnas.concepto, y + 6.5)
    fuente('bold', 10, colorTotal ?? COLOR.texto)
    doc.text(dinero(total), columnas.monto, y + 6.5, { align: 'right' })
    y += 17
  }

  tabla('Detalle de ingresos', reporte.ingresos, reporte.total_ingresos, { colorTotal: COLOR.verde })
  tabla('Detalle de gastos', reporte.gastos, reporte.total_gastos, { conDescripcion: true, colorTotal: COLOR.rojo })

  // ---------- Resultado final ----------
  asegurarEspacio(24)
  doc.setFillColor(...(resultado < 0 ? COLOR.rojo : COLOR.tinto))
  doc.roundedRect(margen, y, anchoUtil, 18, 2.5, 2.5, 'F')
  fuente('bold', 11, COLOR.blanco)
  doc.text('Resultado económico final', margen + 6, y + 8)
  fuente('normal', 8.5, COLOR.blanco)
  doc.text('Ingresos menos gastos del período', margen + 6, y + 13.5)
  fuente('bold', 14, COLOR.blanco)
  doc.text(dinero(reporte.resultado_economico), ancho - margen - 6, y + 11, { align: 'right' })

  // ---------- Pie en todas las páginas ----------
  const paginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...COLOR.linea)
    doc.setLineWidth(0.3)
    doc.line(margen, pieY - 4, ancho - margen, pieY - 4)
    fuente('normal', 8, COLOR.suave)
    doc.text('ComiTrack · Reporte de rentabilidad', margen, pieY)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, pieY, { align: 'right' })
  }
  return doc
}

// Carga la fuente y el canguro (si fallan, el PDF se arma igual con Helvetica) y lo descarga.
export async function descargarReportePdf(reporte) {
  let recursos = {}
  try {
    const { cargarRecursosPdf } = await import('./pdfRecursos.js')
    recursos = await cargarRecursosPdf()
  } catch (error) {
    console.error('No se pudieron cargar la fuente o el logo del PDF:', error)
  }
  crearDocumentoReporte(reporte, recursos).save(`reporte_rentabilidad_${reporte.periodo.desde}_${reporte.periodo.hasta}.pdf`)
}
