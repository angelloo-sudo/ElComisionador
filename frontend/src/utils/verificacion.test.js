import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compararPerfil, enmascararDni, extraerDatosDni, formatearEstadoVerificacion } from './verificacion.js'

describe('utilidades de verificación de identidad', () => {
  it('extrae datos con etiquetas en líneas separadas sin confundir fechas con DNI', () => {
    const datos = extraerDatosDni(`APELLIDO\nPEREZ\nNOMBRE\nMARTINA SOFIA\nDNI 30.456.789\nFECHA DE NACIMIENTO 12/04/1998\nVENCIMIENTO 12/04/2030\nNUMERO DE TRAMITE 00451023987`)
    assert.equal(datos.apellido, 'PEREZ')
    assert.equal(datos.nombre, 'MARTINA SOFIA')
    assert.equal(datos.dni, '30456789')
    assert.equal(datos.fecha_nacimiento, '12/04/1998')
    assert.equal(datos.fecha_vencimiento, '12/04/2030')
    assert.equal(datos.numero_tramite, '00451023987')
    assert.equal(datos.resultado_ocr, 'legible')
  })

  it('marca lecturas parciales y compara nombres sin acentos', () => {
    const datos = extraerDatosDni('DNI 1234567\nNOMBRE JOSE\nAPELLIDO NUNEZ')
    assert.equal(datos.resultado_ocr, 'legible')
    assert.deepEqual(compararPerfil(datos, { nombre: 'José', apellido: 'Núñez', dni: '1234567' }), { nombre: true, apellido: true, dni: true })
    assert.equal(extraerDatosDni('DNI').resultado_ocr, 'no_legible')
  })

  it('enmascara el DNI y presenta los estados existentes', () => {
    assert.equal(enmascararDni('30.456.789'), '••••6789')
    assert.equal(enmascararDni('123'), '')
    assert.equal(formatearEstadoVerificacion('PENDIENTE_REVISION'), 'Pendiente de revisión')
  })
})
