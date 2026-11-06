import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clasificarRentabilidad } from '../src/services/reportes-rentabilidad.service.js'
import { validarFiltrosGraficos } from '../src/controllers/graficos-rentabilidad.controller.js'

describe('US51: filtros y cálculos de gráficos de rentabilidad', () => {
  it('acepta rangos inclusivos y agrupaciones diaria, semanal y mensual', () => {
    for (const agrupacion of ['dia', 'semana', 'mes']) {
      assert.deepEqual(validarFiltrosGraficos({ desde: '2026-10-01', hasta: '2026-10-31', agrupacion }), { agrupacion })
    }
    assert.deepEqual(validarFiltrosGraficos({ desde: '2026-11-06', hasta: '2026-11-06' }), { agrupacion: 'mes' })
  })

  it('rechaza fechas imposibles, rangos invertidos y agrupaciones no permitidas', () => {
    assert.match(validarFiltrosGraficos({ desde: '2026-02-30', hasta: '2026-03-01' }).error, /inicio/)
    assert.match(validarFiltrosGraficos({ desde: '2026-11-07', hasta: '2026-11-06' }).error, /posterior/)
    assert.match(validarFiltrosGraficos({ desde: '2026-11-01', hasta: '2026-11-30', agrupacion: 'trimestre' }).error, /agrupación/)
  })

  it('reutiliza la suma decimal exacta y clasifica ganancia, pérdida y equilibrio', () => {
    assert.deepEqual(clasificarRentabilidad('100.10', '25.09'), {
      total_ingresos: '100.10', total_gastos: '25.09', resultado_economico: '75.01', clasificacion: 'ganancia',
    })
    assert.equal(clasificarRentabilidad('5.00', '10.00').clasificacion, 'perdida')
    assert.equal(clasificarRentabilidad('10.01', '10.01').clasificacion, 'equilibrio')
  })
})
