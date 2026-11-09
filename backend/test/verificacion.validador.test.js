import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validarEnvioVerificacion, validarIdVerificacion, validarResolucion, validarVerificacionRegistro } from '../src/validators/verificacion.validador.js'

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

  it('exige OCR legible y todos los pasos faciales completados', () => {
    assert.match(validarEnvioVerificacion({ ...envio, resultado_ocr: 'no_legible' }), /OCR/)
    assert.match(validarEnvioVerificacion({ ...envio, resultado_ocr: 'requiere_revision' }), /OCR/)
    assert.match(validarEnvioVerificacion({ ...envio, controles_faciales: { ...envio.controles_faciales, giro: false } }), /completarse/)
  })

  it('valida la solicitud enviada junto con el registro sin admitir aprobación del usuario', () => {
    assert.equal(validarVerificacionRegistro({ consentimiento: true, ...envio }), null)
    assert.equal(validarVerificacionRegistro({ consentimiento: true, ...envio, coincidencias: { nombre: false, apellido: false, dni: false } }), null)
    assert.match(validarVerificacionRegistro({ consentimiento: true, ...envio, resultado_ocr: 'no_legible' }), /OCR/)
    assert.match(validarVerificacionRegistro({ consentimiento: true, ...envio, estado: 'APROBADA_MANUALMENTE' }), /no es válida/)
    assert.match(validarVerificacionRegistro({ consentimiento: false, ...envio }), /no es válida/)
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
