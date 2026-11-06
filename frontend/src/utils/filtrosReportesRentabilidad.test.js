import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarRangoReportesRentabilidad } from './filtrosReportesRentabilidad.js'

describe('filtros del historial de rentabilidad (US52)', () => {
  it('permite limpiar las fechas o consultar un único día', () => {
    assert.equal(validarRangoReportesRentabilidad('', ''), null)
    assert.equal(validarRangoReportesRentabilidad('2026-11-06', '2026-11-06'), null)
  })

  it('solicita ambas fechas y rechaza fechas inválidas o invertidas', () => {
    assert.match(validarRangoReportesRentabilidad('2026-11-01', ''), /ambas fechas/)
    assert.match(validarRangoReportesRentabilidad('', '2026-11-30'), /ambas fechas/)
    assert.match(validarRangoReportesRentabilidad('2026-02-30', '2026-03-01'), /inicio/)
    assert.match(validarRangoReportesRentabilidad('2026-12-01', '2026-11-30'), /posterior/)
  })
})
