import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarEnvioVerificacion, validarIdVerificacion, validarResolucion } from '../src/validators/verificacion.validador.js'

const envio = {
  dni_parcial: '••••6789',
  resultado_ocr: 'legible',
  coincidencias: { nombre: true, apellido: false, dni: true },
  controles_faciales: { rostro_unico: true, parpadeo: true, giro: true, frente: true },
}

describe('validador de verificaciones de identidad', () => {
  it('acepta solo resultados mínimos y el DNI enmascarado', () => {
    assert.equal(validarEnvioVerificacion(envio), null)
    assert.match(validarEnvioVerificacion({ ...envio, dni_parcial: '30123456' }), /parcialmente oculto/)
    assert.match(validarEnvioVerificacion({ ...envio, imagen: 'base64...' }), /campos no permitidos/)
    assert.match(validarEnvioVerificacion({ ...envio, coincidencias: { ...envio.coincidencias, datos_ocr: 'texto' } }), /coincidencias/)
  })

  it('requiere resultados de cámara booleanos, pero permite OCR no legible', () => {
    assert.equal(validarEnvioVerificacion({ ...envio, resultado_ocr: 'no_legible' }), null)
    assert.match(validarEnvioVerificacion({ ...envio, controles_faciales: { ...envio.controles_faciales, giro: 'sí' } }), /booleanos/)
  })

  it('valida decisiones y motivos administrativos', () => {
    assert.equal(validarResolucion({ decision: 'APROBADA_MANUALMENTE' }), null)
    assert.match(validarResolucion({ decision: 'RECHAZADA' }), /motivo/)
    assert.equal(validarResolucion({ decision: 'REQUIERE_CORRECCION', motivo: 'Revisar el apellido' }), null)
    assert.match(validarResolucion({ decision: 'APROBADA_MANUALMENTE', aprobado_por_cliente: true }), /decisión/)
  })

  it('acepta solo identificadores positivos seguros', () => {
    assert.equal(validarIdVerificacion('12'), true)
    assert.equal(validarIdVerificacion('0'), false)
    assert.equal(validarIdVerificacion('1x'), false)
  })
})
