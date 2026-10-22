// Envio de emails transaccionales (recuperacion de contraseña) via SMTP con Nodemailer.
import nodemailer from 'nodemailer'

export async function enviarEmailRecuperacion(destinatario, link) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER } = process.env
  if (!SMTP_HOST) {
    throw new Error('Falta configurar SMTP_HOST para enviar correos')
  }
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    ...(SMTP_USER || password ? { auth: { user: SMTP_USER, pass: password } } : {}),
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to: destinatario,
    subject: 'Recuperá tu contraseña de ComiTrack',
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña de ComiTrack.</p>
      <p><a href="${link}">Hacé click acá para elegir una nueva contraseña</a></p>
      <p>Este enlace vence en 1 hora. Si vos no lo pediste, podés ignorar este mensaje.</p>
    `,
  })
}