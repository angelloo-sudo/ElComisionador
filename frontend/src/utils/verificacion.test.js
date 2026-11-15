import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compararPerfil, consolidarLecturasPDF417, detectarTipoImagenDni, esErrorPDF417SinCodigo, extraerDatosPDF417, formatearEstadoVerificacion } from './verificacion.js'

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

  it('consolida lecturas de ambas caras y rechaza datos contradictorios', () => {
    const frente = '12345678901@PEREZ@MARTINA SOFIA@F@30456789@A@12/04/1998@12/04/2023@203'
    const dorso = 'ID@30456789@F@ARG@PEREZ@MARTINA SOFIA@ARG@12/04/1998@F@12/04/2020@0001@TRAMITE@12/04/2030@X@Y@Z'
    assert.deepEqual(consolidarLecturasPDF417([frente, dorso]), {
      estado: 'OK', datos: { dni: '30456789', nombre: 'MARTINA SOFIA', apellido: 'PEREZ' },
    })
    assert.deepEqual(consolidarLecturasPDF417([null, frente]), {
      estado: 'OK', datos: { dni: '30456789', nombre: 'MARTINA SOFIA', apellido: 'PEREZ' },
    })
    assert.deepEqual(consolidarLecturasPDF417([frente, dorso.replace('30456789', '30456780')]), {
      estado: 'INCONSISTENTE', datos: null,
    })
    assert.deepEqual(consolidarLecturasPDF417([]), { estado: 'SIN_LECTURA', datos: null })
  })

  it('interpreta la representación PDF417 "xx" como Ñ solo al comparar un nombre que contiene Ñ', () => {
    const frente = '12345678901@VILLAFAÑE@MARTINA SOFIA@F@30456789@A@12/04/1998@12/04/2023@203'
    const dorso = 'ID@30456789@F@ARG@VILLAFAxxE@MARTINA SOFIA@ARG@12/04/1998@F@12/04/2020@0001@TRAMITE@12/04/2030@X@Y@Z'
    assert.equal(consolidarLecturasPDF417([frente, dorso]).estado, 'OK')
    assert.deepEqual(compararPerfil(
      { dni: '30456789', nombre: 'MARTINA SOFIA', apellido: 'VILLAFAxxE' },
      { dni: '30456789', nombre: 'Martina Sofía', apellido: 'Villafañe' },
    ), { nombre: true, apellido: true, dni: true })
    assert.equal(compararPerfil(
      { dni: '30456789', nombre: 'MARTINA', apellido: 'VILLAFAxxE' },
      { dni: '30456789', nombre: 'Martina', apellido: 'Villafaye' },
    ).apellido, false)
  })

  it('detecta el formato de imagen por su contenido y no por el MIME del navegador', async () => {
    const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], { type: 'application/octet-stream' })
    const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])])
    const webp = new Blob(['RIFF', new Uint8Array(4), 'WEBP'])
    const archivoNoImagen = new Blob(['No es una imagen'], { type: 'image/jpeg' })

    assert.equal(await detectarTipoImagenDni(jpeg), 'image/jpeg')
    assert.equal(await detectarTipoImagenDni(png), 'image/png')
    assert.equal(await detectarTipoImagenDni(webp), 'image/webp')
    assert.equal(await detectarTipoImagenDni(archivoNoImagen), null)
  })

  it('reconoce errores de lectura ZXing por su tipo y continúa con la otra cara', () => {
    assert.equal(esErrorPDF417SinCodigo({ getKind: () => 'NotFoundException' }), true)
    assert.equal(esErrorPDF417SinCodigo({ name: 'ChecksumException' }), true)
    assert.equal(esErrorPDF417SinCodigo({ name: 'TypeError' }), false)
  })

  it('compara los valores leídos sin distinguir mayúsculas y minúsculas', () => {
    const datos = extraerDatosPDF417('12345678901@PEREZ@MARTINA SOFIA@F@30456789@A@12/04/1998@12/04/2023@203')
    assert.deepEqual(compararPerfil(datos, { nombre: 'Martina Sofía', apellido: 'Pérez', dni: '30456789' }), { nombre: true, apellido: true, dni: true })
    assert.deepEqual(compararPerfil(datos, { nombre: 'martina sofia', apellido: 'péREz', dni: '30456789' }), { nombre: true, apellido: true, dni: true })
    assert.equal(compararPerfil(datos, { nombre: 'Ana', apellido: 'Pérez', dni: '30456789' }).nombre, false)
    assert.equal(formatearEstadoVerificacion('PENDIENTE_REVISION'), 'Pendiente de revisión')
  })
})
