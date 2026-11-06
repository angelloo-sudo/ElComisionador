function aCentavos(monto) {
  const texto = String(monto)
  const coincidencia = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(texto)
  if (!coincidencia) throw new Error(`Monto NUMERIC inesperado: ${texto}`)
  const centavos = BigInt(coincidencia[2]) * 100n + BigInt((coincidencia[3] ?? '').padEnd(2, '0'))
  return coincidencia[1] === '-' ? -centavos : centavos
}

function desdeCentavos(centavos) {
  const signo = centavos < 0n ? '-' : ''
  const absoluto = centavos < 0n ? -centavos : centavos
  return `${signo}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, '0')}`
}

export function resumirRentabilidad(ingresos, gastos) {
  const totalIngresos = ingresos.reduce((suma, fila) => suma + aCentavos(fila.monto), 0n)
  const totalGastos = gastos.reduce((suma, fila) => suma + aCentavos(fila.monto), 0n)
  return {
    total_ingresos: desdeCentavos(totalIngresos),
    total_gastos: desdeCentavos(totalGastos),
    resultado_economico: desdeCentavos(totalIngresos - totalGastos),
  }
}

export function clasificarRentabilidad(totalIngresos, totalGastos) {
  const resultado = resumirRentabilidad([{ monto: String(totalIngresos) }], [{ monto: String(totalGastos) }])
  const centavos = aCentavos(resultado.resultado_economico)
  return {
    ...resultado,
    clasificacion: centavos > 0n ? 'ganancia' : centavos < 0n ? 'perdida' : 'equilibrio',
  }
}

function movimiento(fila) {
  const trayecto = fila.viaje_id == null ? null : {
    id: fila.viaje_id,
    origen: fila.viaje_origen,
    destino: fila.viaje_destino,
    fecha: fila.viaje_fecha,
  }
  return {
    id: fila.id,
    fecha: fila.fecha,
    concepto: fila.concepto,
    monto: String(fila.monto),
    ...(Object.hasOwn(fila, 'descripcion') ? { descripcion: fila.descripcion } : {}),
    viaje_id: trayecto?.id ?? null,
    trayecto,
  }
}

export function crearDatosSnapshotRentabilidad({ comisionista, desde, hasta, generadoEn, ingresos, gastos }) {
  const ingresosSnapshot = ingresos.map(movimiento)
  const gastosSnapshot = gastos.map(movimiento)
  const resumen = resumirRentabilidad(ingresosSnapshot, gastosSnapshot)
  const ingresosGenerales = ingresosSnapshot.filter((fila) => fila.trayecto === null)
  const gastosGenerales = gastosSnapshot.filter((fila) => fila.trayecto === null)
  const resumenGeneral = resumirRentabilidad(ingresosGenerales, gastosGenerales)
  const porViaje = new Map()

  const agregar = (filas, tipo) => {
    for (const fila of filas) {
      if (!fila.trayecto) continue
      let acumulado = porViaje.get(String(fila.trayecto.id))
      if (!acumulado) {
        acumulado = { ...fila.trayecto, ingresos: 0n, gastos: 0n }
        porViaje.set(String(fila.trayecto.id), acumulado)
      }
      acumulado[tipo] += aCentavos(fila.monto)
    }
  }
  agregar(ingresosSnapshot, 'ingresos')
  agregar(gastosSnapshot, 'gastos')

  const trayectos = [...porViaje.values()].map((viaje) => {
    const resultado = viaje.ingresos - viaje.gastos
    return {
      id: viaje.id,
      origen: viaje.origen,
      destino: viaje.destino,
      fecha: viaje.fecha,
      total_ingresos: desdeCentavos(viaje.ingresos),
      total_gastos: desdeCentavos(viaje.gastos),
      resultado_economico: desdeCentavos(resultado),
      clasificacion: resultado > 0n ? 'rentable' : resultado < 0n ? 'perdida' : 'equilibrado',
    }
  }).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || Number(a.id) - Number(b.id))

  return {
    version: 1,
    comisionista,
    periodo: { desde, hasta },
    generado_en: generadoEn,
    ...resumen,
    cantidad_movimientos: ingresosSnapshot.length + gastosSnapshot.length,
    ingresos: ingresosSnapshot,
    gastos: gastosSnapshot,
    trayectos,
    movimientos_generales: {
      ...resumenGeneral,
      ingresos: ingresosGenerales,
      gastos: gastosGenerales,
    },
  }
}
