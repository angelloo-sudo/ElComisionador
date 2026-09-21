// US10 - Validaciones de negocio para el alta de un viaje.
export function validarViaje(req, res, next) {
  const { origen, destino, fecha, hora_salida, cupo_total } = req.body

  const errores = []

  if (!origen || !origen.trim()) {
    errores.push('El origen es obligatorio')
  }

  if (!destino || !destino.trim()) {
    errores.push('El destino es obligatorio')
  }

  if (!fecha) {
    errores.push('La fecha es obligatoria')
  } else if (Number.isNaN(Date.parse(fecha))) {
    errores.push('La fecha tiene un formato invalido')
  } else {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (new Date(fecha) < hoy) {
      errores.push('La fecha del viaje no puede ser anterior a hoy')
    }
  }

  if (!hora_salida) {
    errores.push('La hora de salida es obligatoria')
  } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(hora_salida)) {
    errores.push('La hora de salida debe tener el formato HH:MM')
  } else {
    const minutos = Number(hora_salida.split(':')[1])
    if (minutos % 5 !== 0) {
      errores.push('La hora de salida debe estar en intervalos de 5 minutos')
    }
  }

  if (cupo_total === undefined || cupo_total === null || cupo_total === '') {
    errores.push('El cupo total es obligatorio')
  } else {
    const cupoNum = Number(cupo_total)
    if (!Number.isInteger(cupoNum) || cupoNum < 1) {
      errores.push('El cupo total debe ser un numero entero mayor o igual a 1')
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  next()
}
