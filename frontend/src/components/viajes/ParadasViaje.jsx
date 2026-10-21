// Paradas de un viaje para el comisionista: quien sube/baja y donde, y una ruta sugerida (solo informativa)
// que reordena las paradas para recorrer menos km. No cambia ningun precio.
import { formatoKm } from '../../utils/tarifa.js'

const VERBO = { sube: 'Sube', baja: 'Baja', retira: 'Retira el paquete', entrega: 'Entrega el paquete' }

// Pines para el mapa: si se muestra la ruta sugerida van numerados segun ese orden.
export function pinesDeParadas(datos, verSugerida) {
  if (!datos) return null
  const lista = verSugerida && datos.sugerencia?.estado === 'ok' ? datos.sugerencia.orden : datos.paradas
  return lista.map((p) => ({
    lat: p.lat, lon: p.lon, accion: p.accion, estado: p.estado, n: verSugerida ? p.n : undefined,
    texto: `${VERBO[p.accion]}: ${p.persona} · ${p.localidad}`,
  }))
}

export default function ParadasViaje({ datos, verSugerida, onVerSugerida }) {
  if (!datos) return null
  const { paradas, sugerencia } = datos
  const lista = verSugerida && sugerencia?.estado === 'ok' ? sugerencia.orden : paradas
  return (
    <div>
      <h3 style={{ marginTop: 18 }}>Paradas del viaje</h3>
      {paradas.length === 0 ? (
        <p className="campo-ayuda">Todavía no hay paradas: ningún pasajero ni encomienda pide subir, bajar o entregar fuera del origen y el destino.</p>
      ) : (
        <ul className="paradas-lista">
          {lista.map((p, i) => (
            <li key={`${p.solicitud_id}-${p.lado}`}>
              <span className={`num ${['sube', 'retira'].includes(p.accion) ? '' : 'baja'} ${p.estado === 'pendiente' ? 'pendiente' : ''}`}>{p.n ?? i + 1}</span>
              <span>
                <b>{VERBO[p.accion]}</b>: {p.persona} · {p.localidad}
                <small>{p.direccion}{p.estado === 'pendiente' ? ' · pendiente de tu respuesta' : ''}{p.tipo === 'encomienda' ? ' · encomienda' : p.cantidad > 1 ? ` · ${p.cantidad} personas` : ''}</small>
              </span>
            </li>
          ))}
        </ul>
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
    </div>
  )
}
