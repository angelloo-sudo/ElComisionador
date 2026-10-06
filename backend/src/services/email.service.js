import nodemailer from 'nodemailer'

export async function enviarEmailVerificacion({ email, token }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST) {
    throw new Error('Falta configurar SMTP_HOST para enviar correos')
  }

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')
  const enlace = `${baseUrl}/verificar-email?token=${encodeURIComponent(token)}`
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    ...(SMTP_USER || SMTP_PASSWORD ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
  })

  await transporte.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject: 'Verificá tu correo de ComiTrack',
    text: `Para verificar tu correo, abrí este enlace dentro de la próxima hora: ${enlace}`,
    html: `<p>Verificá tu correo de ComiTrack abriendo este enlace:</p><p><a href="${enlace}">Verificar correo</a></p><p>El enlace vence en una hora.</p>`,
  })
}