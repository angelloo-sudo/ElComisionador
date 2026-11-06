import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resumirRentabilidad, validarPeriodoRentabilidad } from '../src/controllers/finanzas.controller.js'
import { crearDatosSnapshotRentabilidad } from '../src/services/reportes-rentabilidad.service.js'

describe('reporte de rentabilidad: validación y suma decimal exacta', () => {
  it('acepta fechas reales, incluido período de un día', () => {
    assert.equal(validarPeriodoRentabilidad('2026-11-06', '2026-11-06'), null)
  })

  it('rechaza fechas incompletas, imposibles o invertidas', () => {
    assert.match(validarPeriodoRentabilidad('', '2026-11-06'), /inicio/)
    assert.match(validarPeriodoRentabilidad('2026-02-31', '2026-03-01'), /inicio/)
    assert.match(validarPeriodoRentabilidad('2026-11-07', '2026-11-06'), /posterior/)
  })

  it('calcula los totales y el resultado con precisión de centavos', () => {
    assert.deepEqual(resumirRentabilidad(
      [{ monto: '1000.10' }, { monto: '25.90' }],
      [{ monto: '100.01' }, { monto: '25.99' }],
    ), { total_ingresos: '1026.00', total_gastos: '126.00', resultado_economico: '900.00' })
    assert.deepEqual(resumirRentabilidad([], []), {
      total_ingresos: '0.00', total_gastos: '0.00', resultado_economico: '0.00',
    })
    assert.equal(resumirRentabilidad([], [{ monto: '0.01' }]).resultado_economico, '-0.01')
  })

  it('conserva el detalle y clasifica solo movimientos con viaje_id real', () => {
    const reporte = crearDatosSnapshotRentabilidad({
      comisionista: 'QA Demo', desde: '2026-11-01', hasta: '2026-11-30', generadoEn: '2026-11-30T20:00:00Z',
      ingresos: [
        { id: 1, fecha: '2026-11-01', monto: '200.00', concepto: 'Pasajero', viaje_id: 10, viaje_origen: 'Córdoba', viaje_destino: 'Villa María', viaje_fecha: '2026-11-01' },
        { id: 2, fecha: '2026-11-02', monto: '20.00', concepto: 'Ingreso general', viaje_id: null },
        { id: 3, fecha: '2026-11-03', monto: '30.00', concepto: 'Otro trayecto', viaje_id: 11, viaje_origen: 'Córdoba', viaje_destino: 'Río Cuarto', viaje_fecha: '2026-11-03' },
      ],
      gastos: [
        { id: 4, fecha: '2026-11-01', monto: '50.00', concepto: 'Combustible', descripcion: 'Carga', viaje_id: 10, viaje_origen: 'Córdoba', viaje_destino: 'Villa María', viaje_fecha: '2026-11-01' },
        { id: 5, fecha: '2026-11-02', monto: '20.00', concepto: 'Gasto general', descripcion: null, viaje_id: null },
        { id: 6, fecha: '2026-11-03', monto: '30.00', concepto: 'Peaje', viaje_id: 11, viaje_origen: 'Córdoba', viaje_destino: 'Río Cuarto', viaje_fecha: '2026-11-03' },
        { id: 7, fecha: '2026-11-04', monto: '12.00', concepto: 'Estacionamiento', viaje_id: 12, viaje_origen: 'Córdoba', viaje_destino: 'Alta Gracia', viaje_fecha: '2026-11-04' },
      ],
    })
    assert.equal(reporte.total_ingresos, '250.00')
    assert.equal(reporte.total_gastos, '112.00')
    assert.equal(reporte.resultado_economico, '138.00')
    assert.deepEqual(reporte.trayectos.map((x) => [x.id, x.resultado_economico, x.clasificacion]), [
      [10, '150.00', 'rentable'], [11, '0.00', 'equilibrado'], [12, '-12.00', 'perdida'],
    ])
    assert.equal(reporte.movimientos_generales.ingresos.length, 1)
    assert.equal(reporte.movimientos_generales.gastos.length, 1)
    assert.equal(reporte.ingresos.length + reporte.gastos.length, reporte.cantidad_movimientos)
  })
})
