import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { crearDocumentoReporte } from './reporteRentabilidadPdf.js'

const reporte = {
  comisionista: 'Comisionista QA',
  periodo: { desde: '2026-11-01', hasta: '2026-11-30' },
  generado_en: '2026-11-06T15:00:00.000Z',
  total_ingresos: '1000.50',
  total_gastos: '250.25',
  resultado_economico: '750.25',
  ingresos: [{ id: 1, fecha: '2026-11-01', concepto: 'Cobro de viaje', monto: '1000.50' }],
  gastos: [{ id: 2, fecha: '2026-11-30', concepto: 'Combustible', descripcion: 'Carga', monto: '250.25' }],
}

describe('PDF US49', () => {
  it('crea un PDF a partir del mismo objeto de reporte recibido por la pantalla', () => {
    const bytes = new Uint8Array(crearDocumentoReporte(reporte).output('arraybuffer'))
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF')
    assert.ok(bytes.length > 1000)
  })

  it('admite reportes vacíos con detalle de ambos tipos', () => {
    const vacio = { ...reporte, ingresos: [], gastos: [], total_ingresos: '0.00', total_gastos: '0.00', resultado_economico: '0.00' }
    const bytes = new Uint8Array(crearDocumentoReporte(vacio).output('arraybuffer'))
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF')
  })

  it('usa la fuente Inter y el canguro cuando se le pasan los recursos', () => {
    const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url)).toString('base64')
    const recursos = {
      fuentes: { regular: leer('../assets/fuentes/Inter-Regular.ttf'), bold: leer('../assets/fuentes/Inter-Bold.ttf') },
      logo: `data:image/png;base64,${leer('../assets/canguro-pdf.png')}`,
    }
    const conTrayecto = { ...reporte, ingresos: [{ ...reporte.ingresos[0], trayecto: { origen: 'Córdoba', destino: 'Villa María', fecha: '2026-11-01' } }] }
    const doc = crearDocumentoReporte(conTrayecto, recursos)
    assert.equal(doc.getFont().fontName, 'Inter')
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    const texto = new TextDecoder('latin1').decode(bytes)
    assert.match(texto, /Inter/)
    assert.match(texto, /\/Subtype \/Image/)
  })

  it('continúa en páginas nuevas cuando el detalle es extenso', () => {
    const filas = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, fecha: '2026-11-01', concepto: `Movimiento ${i + 1} con descripción suficientemente larga para ocupar espacio`, monto: '10.00',
    }))
    const doc = crearDocumentoReporte({ ...reporte, ingresos: filas, gastos: filas })
    assert.ok(doc.internal.getNumberOfPages() > 1)
  })
})
