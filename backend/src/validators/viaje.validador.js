// US10 - Validaciones de negocio para el alta de un viaje.
import { esLocalidadValida } from '../services/localidades.service.js'

const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/
// Cuanto dura una repeticion: se crean los viajes de los proximos 3 meses desde la fecha inicial.
export const DURACION_REPETICION_MESES = 3

// Fecha de fin de la repeticion: la inicial + 3 meses calendario (si el mes de destino es mas
// corto, queda en su ultimo dia: 31/01 + 3 meses = 30/04).
function fechaFinRepeticion(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(anio, mes - 1 + DURACION_REPETICION_MESES + 1, 0)).getUTCDate()
  return new Date(Date.UTC(anio, mes - 1 + DURACION_REPETICION_MESES, Math.min(dia, ultimoDia)))
}

function validarHora(valor, etiqueta, errores) {
  if (!valor) {
    errores.push(`La ${etiqueta} es obligatoria`)
    return false
  }
  if (!REGEX_HORA.test(valor)) {
    errores.push(`La ${etiqueta} debe tener el formato HH:MM`)
    return false
  }
  if (Number(valor.split(':')[1]) % 5 !== 0) {
    errores.push(`La ${etiqueta} debe estar en intervalos de 5 minutos`)
    return false
  }
  return true
}

// Devuelve las fechas (YYYY-MM-DD) en las que se va a repetir el viaje, incluyendo
// la fecha inicial si cae en un dia elegido. Trabaja en UTC para evitar corrimientos
// por zona horaria.
// repeticion: { tipo: 'unico' | 'diario' | 'semanal', dias: [0..6] }  (dura DURACION_REPETICION_MESES)
export function generarFechas(fecha, repeticion) {
  if (!repeticion || repeticion.tipo === 'unico' || !repeticion.tipo) return [fecha]

  const dias = repeticion.tipo === 'diario' ? [0, 1, 2, 3, 4, 5, 6] : repeticion.dias.map(Number)
  const fechas = []
  const fin = fechaFinRepeticion(fecha)
  for (let d = new Date(`${fecha}T00:00:00Z`); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    if (dias.includes(d.getUTCDay())) fechas.push(d.toISOString().slice(0, 10))
  }
  return fechas
}

export function validarViaje(req, res, next) {
  const { origen, destino, fecha, hora_salida, hora_llegada, cupo_total, repeticion } = req.body

  const errores = []

  // Origen y destino deben ser una localidad de la lista de Cordoba. Si la lista
  // todavia no fue generada (esLocalidadValida devuelve null) no se bloquea el alta.
  if (!origen || !origen.trim()) {
    errores.push('El origen es obligatorio')
  } else if (esLocalidadValida(origen) === false) {
    errores.push('El origen debe ser una localidad de la lista de Córdoba')
  }

  if (!destino || !destino.trim()) {
    errores.push('El destino es obligatorio')
  } else if (esLocalidadValida(destino) === false) {
    errores.push('El destino debe ser una localidad de la lista de Córdoba')
  }

  let fechaValida = false
  if (!fecha) {
    errores.push('La fecha es obligatoria')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.push('La fecha tiene un formato invalido')
  } else {
    fechaValida = true
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (new Date(fecha) < hoy) {
      errores.push('La fecha del viaje no puede ser anterior a hoy')
    }
  }

  const salidaOk = validarHora(hora_salida, 'hora de salida', errores)
  const llegadaOk = validarHora(hora_llegada, 'hora de llegada', errores)
  if (salidaOk && llegadaOk && hora_llegada <= hora_salida) {
    errores.push('La hora de llegada debe ser posterior a la hora de salida')
  }

  if (cupo_total === undefined || cupo_total === null || cupo_total === '') {
    errores.push('El cupo total es obligatorio')
  } else {
    const cupoNum = Number(cupo_total)
    if (!Number.isInteger(cupoNum) || cupoNum < 1) {
      errores.push('El cupo total debe ser un numero entero mayor o igual a 1')
    }
  }

  // Repeticion (opcional). Si no viene o es 'unico', el viaje es de una sola fecha.
  if (repeticion && repeticion.tipo && repeticion.tipo !== 'unico') {
    if (!['diario', 'semanal'].includes(repeticion.tipo)) {
      errores.push('El tipo de repeticion no es valido')
    } else {
      if (repeticion.tipo === 'semanal') {
        const dias = repeticion.dias
        if (!Array.isArray(dias) || dias.length === 0) {
          errores.push('Elegí al menos un día de la semana para repetir el viaje')
        } else if (!dias.every((d) => Number.isInteger(Number(d)) && d >= 0 && d <= 6)) {
          errores.push('Los días de repetición no son válidos')
        }
      }
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  next()
}
