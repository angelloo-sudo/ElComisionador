const REGEX_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const CAMPOS_PERMITIDOS = new Set(['hora_salida', 'hora_llegada', 'cupo_total', 'paradas'])

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
  if (!Number.isInteger(body.cupo_total) || body.cupo_total < 0) errores.push('El cupo total debe ser un número entero mayor o igual a 0')
  if (body.paradas !== undefined && !Array.isArray(body.paradas)) errores.push('Las paradas deben enviarse como una lista')
  if (Array.isArray(body.paradas)) {
    const localidades = new Set()
    let anterior = body.hora_salida
    for (const [i, p] of body.paradas.entries()) {
      const localidad = typeof p?.localidad === 'string' ? p.localidad.trim() : ''
      if (!localidad) errores.push(`La localidad de la parada ${i + 1} es obligatoria`)
      const clave = localidad.toLocaleLowerCase()
      if (localidades.has(clave)) errores.push(`La localidad ${localidad} está repetida en el recorrido`)
      localidades.add(clave)
      if (!REGEX_HORA.test(p?.hora_estimada ?? '')) errores.push(`La hora estimada de la parada ${i + 1} debe tener formato HH:MM`)
      else {
        if (REGEX_HORA.test(anterior ?? '') && p.hora_estimada <= anterior) errores.push('Los horarios de las paradas deben ser posteriores y estar ordenados')
        if (REGEX_HORA.test(body.hora_llegada ?? '') && p.hora_estimada >= body.hora_llegada) errores.push('Todas las paradas deben ocurrir antes de la llegada al destino final')
        anterior = p.hora_estimada
      }
    }
  }
  if (errores.length) return res.status(400).json({ errores })
  next()
}
