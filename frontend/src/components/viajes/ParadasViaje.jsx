// Paradas de un viaje para el comisionista: quien sube/baja y donde, y una ruta sugerida (solo informativa)
// que reordena las paradas para recorrer menos km. No cambia ningun precio.
import { formatoKm } from '../../utils/tarifa.js'

const VERBO = { sube: 'Sube', baja: 'Baja', retira: 'Retira el paquete', entrega: 'Entrega el paquete' }
const ACCION = {
  sube: 'Recoger pasajero',
  baja: 'Dejar pasajero',
  retira: 'Retirar encomienda',
  entrega: 'Entregar encomienda',
}
const ESTADO_ACTIVIDAD = {
  completada: ['Realizada', 'completada'],
  pendiente: ['Pendiente', 'pendiente'],
  pendiente_respuesta: ['Esperando confirmación', 'esperando'],
  sin_estado: ['Estado no registrado', 'esperando'],
  cancelada: ['Cancelado', 'cancelada'],
}

// Pines para el mapa: si se muestra la ruta sugerida van numerados segun ese orden.
export function pinesDeParadas(datos, verSugerida) {
  if (!datos) return null
  const lista = (verSugerida && datos.sugerencia?.estado === 'ok' ? datos.sugerencia.orden : datos.paradas)
    .filter((p) => p.es_intermedia && p.lat != null && p.lon != null)
  return lista.map((p) => ({
    lat: p.lat, lon: p.lon, accion: p.accion, estado: p.estado_actividad, n: verSugerida ? p.n : undefined,
    texto: `${ACCION[p.accion] ?? VERBO[p.accion]}: ${p.persona} · ${p.localidad}`,
  }))
}

export default function ParadasViaje({ datos, verSugerida, onVerSugerida, origen, destino }) {
  if (!datos) return null
  const { sugerencia } = datos
  const recorrido = datos.recorrido?.paradas ?? []
  const tienePendientesDeOrden = datos.recorrido?.orden_confirmado === false

  return (
    <section className="recorrido-viaje" aria-label="Recorrido y paradas">
      <h3 style={{ marginTop: 18 }}>Recorrido y paradas</h3>
      <p className="recorrido-trayecto"><strong>Recorrido:</strong> {origen} <span aria-hidden="true">→</span> {destino}</p>
      {!recorrido.length ? (
        <p className="campo-ayuda">No hay actividades asociadas a este viaje.</p>
      ) : (
        <>
          {tienePendientesDeOrden && <p className="recorrido-aviso" role="status">El orden de algunas paradas intermedias no se pudo determinar. Revisalo antes de salir.</p>}
          <ol className="recorrido-linea">
            {recorrido.map((parada, indice) => (
              <li className={`recorrido-parada recorrido-parada-${parada.tipo}`} key={`${parada.tipo}-${parada.localidad}`}>
                <span className="recorrido-marcador" aria-hidden="true">
                  {parada.tipo === 'origen' ? 'A' : parada.tipo === 'destino' ? 'B' : datos.recorrido.orden_confirmado ? indice : '?'}
                </span>
                <div className="recorrido-contenido">
                  <div className="recorrido-localidad">
                    <strong>{parada.localidad}</strong>
                    <span>{parada.tipo === 'origen' ? 'Inicio' : parada.tipo === 'destino' ? 'Destino' : 'Parada intermedia'}</span>
                  </div>
                  {parada.actividades.map((actividad, i) => {
                    const estado = ESTADO_ACTIVIDAD[actividad.estado_actividad] ?? ESTADO_ACTIVIDAD.pendiente
                    const finalizar = actividad.accion === 'finalizar'
                    const accion = finalizar
                      ? actividad.estado_viaje === 'cancelado' ? 'Viaje cancelado'
                        : actividad.estado_actividad === 'completada' ? 'Recorrido finalizado' : 'Finalizar recorrido'
                      : ACCION[actividad.accion] ?? VERBO[actividad.accion]
                    return (
                      <div className={`recorrido-actividad recorrido-actividad-${estado[1]}`} key={actividad.actividad_id ?? `${actividad.solicitud_id ?? 'viaje'}-${actividad.lado ?? i}-${actividad.accion}`}>
                        <div>
                          <strong>{accion}{actividad.persona ? `: ${actividad.persona}` : ''}</strong>
                          {!finalizar && actividad.tipo === 'encomienda' && actividad.codigo_seguimiento && (
                            <small>Encomienda · seguimiento #{actividad.codigo_seguimiento}</small>
                          )}
                          {!finalizar && actividad.tipo === 'encomienda' && !actividad.codigo_seguimiento && (
                            <small>Encomienda · {actividad.encomienda_id ? `#${actividad.encomienda_id}` : `solicitud #${actividad.solicitud_id}`}</small>
                          )}
                          {!finalizar && actividad.tipo === 'pasajero' && actividad.cantidad > 1 && (
                            <small>{actividad.cantidad} pasajeros</small>
                          )}
                          {actividad.direccion && <small>{actividad.direccion}</small>}
                        </div>
                        <span className={`recorrido-estado recorrido-estado-${estado[1]}`}>{estado[0]}</span>
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {sugerencia?.estado === 'ok' && (
        <div className="sugerencia-ruta">
          <h4>Ruta sugerida</h4>
          {sugerencia.mejora ? (
            <p>Pasando por las paradas confirmadas en este orden recorrés <b>{formatoKm(sugerencia.km_sugerido)}</b> en vez de {formatoKm(sugerencia.km_actual)}: ahorrás <b>{formatoKm(sugerencia.ahorro_km)}</b>. Los precios de los pasajeros no cambian.</p>
          ) : (
            <p>El orden natural de las paradas ya es el más corto ({formatoKm(sugerencia.km_actual)} en total). Los precios de los pasajeros no cambian.</p>
          )}
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => onVerSugerida(!verSugerida)}>
            {verSugerida ? 'Ocultar ruta sugerida' : 'Ver ruta sugerida en el mapa'}
          </button>
        </div>
      )}
      {sugerencia?.estado === 'demasiadas' && <p className="campo-ayuda">Hay demasiadas paradas para sugerir una ruta.</p>}
      {sugerencia?.estado === 'no_disponible' && <p className="campo-ayuda">No pudimos calcular la ruta sugerida ahora. Probá de nuevo en unos minutos.</p>}
    </section>
  )
}
