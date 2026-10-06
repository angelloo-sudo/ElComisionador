// Envio de emails transaccionales (recuperacion de contraseña) via SMTP con Nodemailer.
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true solo si usan el puerto 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function enviarEmailRecuperacion(destinatario, link) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinatario,
    subject: 'Recuperá tu contraseña de ComiTrack',
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña de ComiTrack.</p>
      <p><a href="${link}">Hacé click acá para elegir una nueva contraseña</a></p>
      <p>Este enlace vence en 1 hora. Si vos no lo pediste, podés ignorar este mensaje.</p>
    `,
  })
}