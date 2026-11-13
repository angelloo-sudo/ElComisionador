import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compararPerfil, enmascararDni, extraerDatosPDF417, formatearEstadoVerificacion } from './verificacion.js'

describe('lectura local del PDF417 argentino', () => {
  it('extrae los tres datos del formato actual', () => {
    const datos = extraerDatosPDF417('12345678901@PEREZ@MARTINA SOFIA@F@30456789@A@12/04/1998@12/04/2023@203')
    assert.deepEqual(datos, { dni: '30456789', nombre: 'MARTINA SOFIA', apellido: 'PEREZ' })
  })

  it('extrae DNI, apellido y nombre del formato anterior', () => {
    const datos = extraerDatosPDF417('ID@30456789@F@ARG@PEREZ@MARTINA SOFIA@ARG@12/04/1998@F@12/04/2020@0001@TRAMITE@12/04/2030@X@Y@Z')
    assert.deepEqual(datos, { dni: '30456789', nombre: 'MARTINA SOFIA', apellido: 'PEREZ' })
  })

  it('rechaza códigos desconocidos o campos incompletos sin inventar valores', () => {
    assert.equal(extraerDatosPDF417('texto que no es PDF417'), null)
    assert.equal(extraerDatosPDF417('123@PEREZ@MARTINA@F@DNI@A@12/04/1998@12/04/2023'), null)
  })

  it('compara los valores leídos y solo expone el DNI enmascarado en la interfaz', () => {
    const datos = extraerDatosPDF417('12345678901@PEREZ@MARTINA SOFIA@F@30456789@A@12/04/1998@12/04/2023@203')
    assert.deepEqual(compararPerfil(datos, { nombre: 'Martina Sofía', apellido: 'Pérez', dni: '30456789' }), { nombre: true, apellido: true, dni: true })
    assert.equal(compararPerfil(datos, { nombre: 'Ana', apellido: 'Pérez', dni: '30456789' }).nombre, false)
    assert.equal(enmascararDni(datos.dni), '••••6789')
    assert.equal(enmascararDni('123'), '')
    assert.equal(formatearEstadoVerificacion('PENDIENTE_REVISION'), 'Pendiente de revisión')
  })
})
