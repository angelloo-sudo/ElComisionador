import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarFiltrosPeriodoReporte } from '../src/controllers/reportes-rentabilidad.controller.js'

describe('US52: validación del rango de reportes históricos', () => {
  it('permite consultar sin filtros', () => {
    assert.deepEqual(validarFiltrosPeriodoReporte(undefined, undefined), { fechaInicio: null, fechaFin: null })
    assert.deepEqual(validarFiltrosPeriodoReporte('', ''), { fechaInicio: null, fechaFin: null })
  })

  it('acepta el mismo día y los extremos inclusivos como rango', () => {
    assert.deepEqual(validarFiltrosPeriodoReporte('2026-11-06', '2026-11-06'), {
      fechaInicio: '2026-11-06', fechaFin: '2026-11-06',
    })
  })

  it('rechaza el filtro parcial, fechas imposibles y rangos invertidos', () => {
    assert.match(validarFiltrosPeriodoReporte('2026-11-01', undefined).error, /ambas fechas/)
    assert.match(validarFiltrosPeriodoReporte(undefined, '2026-11-30').error, /ambas fechas/)
    assert.match(validarFiltrosPeriodoReporte('2026-02-30', '2026-03-01').error, /inicio/)
    assert.match(validarFiltrosPeriodoReporte('2026-12-01', '2026-11-30').error, /posterior/)
  })
})
