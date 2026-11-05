import { calcularRuta } from './geo.service.js'

const aMinutos = (hora) => {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
const comoHora = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// Calcula en orden cada tramo consecutivo. No incorpora tiempos de espera en las paradas.
export async function calcularHorarioRecorrido(origen, destino, paradas, horaSalida, obtenerRuta = calcularRuta) {
  const puntos = [origen, ...paradas.map((p) => p.localidad.trim()), destino]
  const tramos = await Promise.all(puntos.slice(0, -1).map((p, i) => obtenerRuta(p, puntos[i + 1])))
  if (tramos.some((t) => t.aproximada || !Number.isFinite(Number(t.duracion_min)))) {
    throw new Error('No se pudieron calcular con precisión los tiempos de todos los tramos')
  }
  let minutos = aMinutos(horaSalida)
  const llegadas = []
  for (const tramo of tramos) {
    minutos += Math.round(Number(tramo.duracion_min))
    if (minutos > 1439) {
      const error = new Error('El recorrido estimado termina después de la medianoche')
      error.code = 'HORARIO_MEDIANOCHE'
      throw error
    }
    llegadas.push(comoHora(minutos))
  }
  return {
    paradas: paradas.map((p, i) => ({ ...p, hora_estimada: llegadas[i] })),
    hora_llegada: llegadas.at(-1),
    duracion_min: tramos.reduce((s, t) => s + Math.round(Number(t.duracion_min)), 0),
    distancia_km: tramos.reduce((s, t) => s + Number(t.distancia_km || 0), 0),
    tramos,
  }
}
