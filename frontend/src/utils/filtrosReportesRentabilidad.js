export function validarRangoReportesRentabilidad(fechaInicio, fechaFin) {
  const inicio = fechaInicio || ''
  const fin = fechaFin || ''
  if ((inicio === '') !== (fin === '')) return 'Completá ambas fechas o limpiá los filtros.'
  if (!inicio) return null
  const esFechaValida = (valor) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
    const [anio, mes, dia] = valor.split('-').map(Number)
    const fecha = new Date(Date.UTC(anio, mes - 1, dia))
    return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  }
  if (!esFechaValida(inicio)) return 'La fecha de inicio no es válida.'
  if (!esFechaValida(fin)) return 'La fecha de fin no es válida.'
  if (inicio > fin) return 'La fecha de inicio no puede ser posterior a la fecha de fin.'
  return null
}
