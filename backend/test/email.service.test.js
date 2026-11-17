import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { afterEach, it, mock } from 'node:test'
import nodemailer from 'nodemailer'
import { enviarEmailVerificacion } from '../src/services/email.service.js'

const variablesEntorno = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_PASS', 'SMTP_FROM', 'FRONTEND_URL']
const entornoOriginal = Object.fromEntries(variablesEntorno.map((nombre) => [nombre, process.env[nombre]]))

afterEach(() => {
  for (const nombre of variablesEntorno) {
    if (entornoOriginal[nombre] === undefined) delete process.env[nombre]
    else process.env[nombre] = entornoOriginal[nombre]
  }
})

it('envía la misma plantilla responsive a clientes y comisionistas con su enlace único', async () => {
  const enviados = []
  process.env.SMTP_HOST = 'smtp.example.test'
  process.env.FRONTEND_URL = 'https://app.comitrack.test/'
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (correo) => { enviados.push(correo) },
  }))

  const destinatarios = [
    { email: 'cliente@example.test', token: 'cliente+token/1' },
    { email: 'comisionista@example.test', token: 'comisionista+token/2' },
  ]

  for (const destinatario of destinatarios) {
    await enviarEmailVerificacion(destinatario)
  }

  assert.equal(enviados.length, 2)
  for (const [indice, correo] of enviados.entries()) {
    const enlace = `https://app.comitrack.test/verificar-email?token=${encodeURIComponent(destinatarios[indice].token)}`
    assert.equal(correo.to, destinatarios[indice].email)
    assert.match(correo.text, /Recibimos tu solicitud de registro en ComiTrack/)
    assert.ok(correo.text.includes(enlace))
    assert.match(correo.text, /vence en una hora/i)
    assert.ok(correo.html.includes(`href="${enlace}"`))
    assert.match(correo.html, /Verificar correo/)
    assert.match(correo.html, /style="[^"]*padding:16px 36px/)
    assert.match(correo.html, /<img src="cid:comitrack-logo" alt="ComiTrack" width="180"/)
    assert.ok(correo.html.indexOf('cid:comitrack-logo') < correo.html.indexOf('Recibimos tu solicitud de registro en ComiTrack'))
    assert.equal(correo.attachments.length, 1)
    assert.equal(correo.attachments[0].filename, 'logo-comitrack-transparente.png')
    assert.equal(correo.attachments[0].contentType, 'image/png')
    assert.equal(correo.attachments[0].cid, 'comitrack-logo')
    assert.deepEqual(correo.attachments[0].content, await readFile(new URL('../../frontend/public/logo-comitrack-transparente.png', import.meta.url)))
    assert.match(correo.html, /@media only screen and \(max-width: 600px\)/)
    assert.match(correo.html, /Si no solicitaste crear una cuenta en ComiTrack, podés ignorar este correo/)
    assert.match(correo.html, /¡Gracias por sumarte a ComiTrack!/)
    assert.match(correo.html, /El equipo de ComiTrack/)
  }

  assert.notEqual(enviados[0].html, enviados[1].html)
})
