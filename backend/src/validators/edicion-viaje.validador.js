const REGEX_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const CAMPOS_PERMITIDOS = new Set(['hora_salida', 'hora_llegada', 'cupo_total'])

export function validarEdicionViaje(req, res, next) {
  const body = req.body ?? {}
  const camposExtra = Object.keys(body).filter((campo) => !CAMPOS_PERMITIDOS.has(campo))
  if (camposExtra.length) return res.status(400).json({ mensaje: 'Solo se pueden modificar los horarios y la capacidad del viaje' })
  const errores = []
  if (typeof body.hora_salida !== 'string' || !REGEX_HORA.test(body.hora_salida)) errores.push('La hora de salida debe tener formato HH:MM')
  if (typeof body.hora_llegada !== 'string' || !REGEX_HORA.test(body.hora_llegada)) errores.push('La hora de llegada debe tener formato HH:MM')
  if (REGEX_HORA.test(body.hora_salida) && REGEX_HORA.test(body.hora_llegada) && body.hora_llegada <= body.hora_salida) {
    errores.push('La hora de llegada debe ser posterior a la salida y corresponder al mismo día')
  }
  if (!Number.isInteger(body.cupo_total) || body.cupo_total < 1) errores.push('El cupo total debe ser un número entero mayor o igual a 1')
  if (errores.length) return res.status(400).json({ errores })
  next()
}
