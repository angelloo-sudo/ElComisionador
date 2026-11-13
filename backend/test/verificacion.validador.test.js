import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compararDatosDocumentoPerfil, validarDatosDocumento, validarEnvioVerificacion, validarIdVerificacion, validarResolucion } from '../src/validators/verificacion.validador.js'

describe('validaciones del flujo de identidad', () => {
  it('compara los campos del PDF417 con el perfil y no acepta valores incompletos como coincidencia', () => {
    assert.deepEqual(compararDatosDocumentoPerfil({ dni: '30.456.789', nombre: 'MARTINA   SOFIA', apellido: 'PEREZ' }, { dni: '30456789', nombre: 'Martina Sofía', apellido: 'Pérez' }), {
      completo: true, coincidencias: { dni: true, nombre: true, apellido: true }, dni_parcial: '••••6789',
    })
    const parcial = compararDatosDocumentoPerfil({ dni: '', nombre: 'MARTINA', apellido: '' }, { dni: '30456789', nombre: 'Martina', apellido: 'Perez' })
    assert.equal(parcial.completo, false)
    assert.equal(parcial.coincidencias.dni, null)
    assert.equal(parcial.coincidencias.apellido, null)
    assert.equal(compararDatosDocumentoPerfil({ dni: '30456780', nombre: 'OTRA', apellido: 'PERSONA' }, { dni: '30456789', nombre: 'Martina', apellido: 'Perez' }).coincidencias.dni, false)
  })

  it('admite solo los campos mínimos del documento y no acepta controles faciales', () => {
    assert.equal(validarDatosDocumento({ dni: '30456789', nombre: 'Martina', apellido: 'Perez' }), null)
    assert.notEqual(validarDatosDocumento({ dni: '30456789', nombre: 'Martina', apellido: 'Perez', aprobada: true }), null)
    assert.equal(validarEnvioVerificacion({}), null)
    assert.notEqual(validarEnvioVerificacion({ resultado_ocr: 'legible', coincidencias: { nombre: true } }), null)
    assert.notEqual(validarEnvioVerificacion({ controles_faciales: { rostro_unico: true } }), null)
  })

  it('valida decisiones administrativas y sus motivos', () => {
    assert.equal(validarResolucion({ decision: 'APROBADA_MANUALMENTE' }), null)
    assert.match(validarResolucion({ decision: 'RECHAZADA' }), /motivo/)
    assert.equal(validarResolucion({ decision: 'REQUIERE_CORRECCION', motivo: 'Revisar apellido' }), null)
    assert.notEqual(validarResolucion({ decision: 'APROBADA_MANUALMENTE', aprobado_por_cliente: true }), null)
  })

  it('acepta solo identificadores positivos seguros', () => {
    assert.equal(validarIdVerificacion('12'), true)
    assert.equal(validarIdVerificacion('0'), false)
    assert.equal(validarIdVerificacion('1x'), false)
  })
})
