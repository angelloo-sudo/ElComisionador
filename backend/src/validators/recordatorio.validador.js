export function validarAnticipacionRecordatorio(minutos, segundosRestantes = Infinity) {
  if (!Number.isSafeInteger(minutos) || minutos < 1 || minutos > 10080) {
    return 'Elegí una anticipación entre 1 minuto y 7 días'
  }
  if (segundosRestantes <= 0 || minutos * 60 > segundosRestantes) {
    return 'La anticipación no puede superar el tiempo que falta para el inicio del viaje'
  }
  return null
}
