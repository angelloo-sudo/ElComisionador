const FECHA = /^\d{4}-\d{2}-\d{2}$/

export function fechaISOValida(valor) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return false
  const fecha = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor
}

export function validarRangoFechas({ desde, hasta } = {}) {
  for (const fecha of [desde, hasta]) {
    if (fecha != null && fecha !== '' && !fechaISOValida(fecha)) return 'Las fechas deben tener formato AAAA-MM-DD'
  }
  if (desde && hasta && desde > hasta) return 'La fecha de inicio no puede ser posterior a la fecha de fin'
  return null
}

export function agregarFiltroFechas({ desde, hasta }, columna, params) {
  const error = validarRangoFechas({ desde, hasta })
  if (error) return { error }
  const clauses = []
  if (desde) { params.push(desde); clauses.push(`${columna} >= $${params.length}::date`) }
  if (hasta) { params.push(hasta); clauses.push(`${columna} < ($${params.length}::date + INTERVAL '1 day')`) }
  return { clauses }
}
