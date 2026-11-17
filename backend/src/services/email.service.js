import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const LOGO_PATH = fileURLToPath(new URL('../../../frontend/public/logo-comitrack-transparente.png', import.meta.url))
const LOGO_CID = 'comitrack-logo'

function escaparAtributoHtml(valor) {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function crearContenidoVerificacion(enlace) {
  const enlaceHtml = escaparAtributoHtml(enlace)
  const introduccion = 'Recibimos tu solicitud de registro en ComiTrack. Para activar y verificar tu cuenta, necesitamos confirmar tu dirección de correo electrónico.'
  const vencimiento = 'Este enlace de verificación vence en una hora. Si no solicitaste crear una cuenta en ComiTrack, podés ignorar este correo.'
  const texto = `${introduccion}\n\nVerificar correo: ${enlace}\n\n${vencimiento}\n\n¡Gracias por sumarte a ComiTrack!\nEl equipo de ComiTrack`
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 24px 12px !important; }
        .email-card-content { padding: 30px 22px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif; color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f1f5f9;">
      <tr>
        <td class="email-shell" align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:560px; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px;">
            <tr>
              <td class="email-card-content" align="center" style="padding:40px 44px;">
                <img src="cid:${LOGO_CID}" alt="ComiTrack" width="180" style="display:block; width:180px; max-width:100%; height:auto; margin:0 auto 24px; border:0;">
                <h1 style="margin:0 0 16px; color:#0f172a; font-size:25px; line-height:1.3; font-weight:700;">Confirmá tu correo electrónico</h1>
                <p style="margin:0 0 28px; color:#475569; font-size:16px; line-height:1.6;">${introduccion}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 26px;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="border-radius:10px; background-color:#2563eb;">
                      <a href="${enlaceHtml}" style="display:inline-block; padding:16px 36px; border:1px solid #2563eb; border-radius:10px; color:#ffffff; font-size:17px; line-height:1.2; font-weight:700; text-decoration:none;">Verificar correo</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 28px; color:#64748b; font-size:14px; line-height:1.6;">${vencimiento}</p>
                <p style="margin:0 0 6px; color:#334155; font-size:16px; line-height:1.5;">¡Gracias por sumarte a ComiTrack!</p>
                <p style="margin:0; color:#64748b; font-size:14px; line-height:1.5;">El equipo de ComiTrack</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { text: texto, html }
}

export async function enviarEmailVerificacion({ email, token }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_FROM } = process.env
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
  if (!SMTP_HOST) {
    throw new Error('Falta configurar SMTP_HOST para enviar correos')
  }

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')
  const enlace = `${baseUrl}/verificar-email?token=${encodeURIComponent(token)}`
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    ...(SMTP_USER || password ? { auth: { user: SMTP_USER, pass: password } } : {}),
  })
  const contenido = crearContenidoVerificacion(enlace)

  await transporte.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject: 'Verificá tu correo de ComiTrack',
    ...contenido,
    attachments: [{
      filename: 'logo-comitrack-transparente.png',
      content: await readFile(LOGO_PATH),
      contentType: 'image/png',
      cid: LOGO_CID,
    }],
  })
}
export async function enviarEmailRecordatorioViaje({ email, origen, destino, fecha, hora, minutosAnticipacion }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST) throw new Error('Falta configurar SMTP_HOST para enviar correos')

  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    ...(SMTP_USER || SMTP_PASSWORD ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
  })
  const anticipacion = minutosAnticipacion >= 1440
    ? `${Math.round(minutosAnticipacion / 1440)} día(s)`
    : minutosAnticipacion >= 60
      ? `${Math.round(minutosAnticipacion / 60)} hora(s)`
      : `${minutosAnticipacion} minuto(s)`
  const asunto = `Recordatorio de viaje: ${origen} → ${destino}`
  const texto = `Tu viaje de ${origen} a ${destino} comienza el ${fecha} a las ${hora}. Configuraste este aviso con ${anticipacion} de anticipación.`
  await transporte.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject: asunto,
    text: texto,
    html: `<p>${texto}</p>`,
  })
}
