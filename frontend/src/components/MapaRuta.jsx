// Mapa (OpenStreetMap + Leaflet) con la ruta en auto entre el origen y el destino de un viaje.
// La ruta la calcula el backend (/api/geo/ruta). Lo ven el comisionista y el cliente.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/mapa.css'
import { api } from '../api/client.js'
import { formatoDuracion } from '../utils/tarifa.js'

const pinParada = (clase) => L.divIcon({
  className: 'mapa-pin-contenedor',
  html: `<span class="mapa-pin parada ${clase}"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

// Parada de otro pasajero o encomienda: sube/retira (verde) o baja/entrega (vino); mas clara si todavia esta pendiente.
const pinOtraParada = (accion, estado, numero) => L.divIcon({
  className: 'mapa-pin-contenedor',
  html: `<span class="mapa-pin parada otra ${['sube', 'retira'].includes(accion) ? 'sube' : 'baja'} ${estado === 'pendiente' ? 'pendiente' : ''}">${numero ?? ''}</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const pin = (clase, letra) => L.divIcon({
  className: 'mapa-pin-contenedor',
  html: `<span class="mapa-pin ${clase}">${letra}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// tramo (opcional): { desde: {nombre, lat, lon}, hasta: {...}, geometria: [[lat, lon], ...] } resalta el tramo del cliente
// y marca sus paradas (donde sube y donde baja) sobre la ruta completa del viaje.
// paradas (opcional): paradas de otras solicitudes del viaje [{lat, lon, accion, estado, texto, n}].
// rutaSugerida (opcional): [[lat, lon], ...] ruta propuesta al comisionista, dibujada en verde punteado.
// mostrarKm = false oculta los kilometros (el cliente no ve el calculo del precio).
export default function MapaRuta({ origen, destino, alto = 260, onRuta, mostrarLeyenda = true, tramo = null, mostrarKm = true, paradas = null, rutaSugerida = null }) {
  const lienzo = useRef(null)
  const [ruta, setRuta] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true); setError(null); setRuta(null); onRuta?.(null)
    api.get(`/geo/ruta?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`)
      .then((r) => { if (vigente) { setRuta(r); onRuta?.(r) } })
      .catch((e) => { if (vigente) { setError(e.message); onRuta?.(null) } })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, destino])

  useEffect(() => {
    if (!ruta || !lienzo.current) return undefined
    const mapa = L.map(lienzo.current, { scrollWheelZoom: false, attributionControl: true })
    mapa.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(mapa)
    // Doble linea: contorno claro + trazo de color, para que se lea sobre cualquier mapa.
    L.polyline(ruta.geometria, { color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(mapa)
    const conTramo = Boolean(tramo?.geometria?.length > 1)
    const trazo = L.polyline(ruta.geometria, {
      // Con tramo, la ruta completa queda mas tenue y el tramo del cliente se dibuja encima.
      color: conTramo ? '#b9a79b' : '#7a2a3a', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round',
      dashArray: ruta.aproximada || conTramo ? '8 8' : null,
    }).addTo(mapa)
    L.marker([ruta.origen.lat, ruta.origen.lon], { icon: pin('origen', 'A'), title: `Origen: ${origen}` }).addTo(mapa)
    L.marker([ruta.destino.lat, ruta.destino.lon], { icon: pin('destino', 'B'), title: `Destino: ${destino}` }).addTo(mapa)
    if (conTramo) {
      L.polyline(tramo.geometria, { color: '#ffffff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(mapa)
      L.polyline(tramo.geometria, { color: '#7a2a3a', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(mapa)
      const parada = (p, clase, texto) => L.marker([p.lat, p.lon], { icon: pinParada(clase), title: `${texto}: ${p.nombre}`, zIndexOffset: 500 })
        .bindTooltip(`${texto}: ${p.nombre}`, { permanent: true, direction: 'top', offset: [0, -14], className: 'mapa-etiqueta' })
        .addTo(mapa)
      parada(tramo.desde, 'sube', 'Subís')
      parada(tramo.hasta, 'baja', 'Bajás')
    }
    if (rutaSugerida?.length > 1) {
      L.polyline(rutaSugerida, { color: '#ffffff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(mapa)
      L.polyline(rutaSugerida, { color: '#3f7d58', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: '10 8' }).addTo(mapa)
    }
    for (const p of paradas ?? []) {
      L.marker([p.lat, p.lon], { icon: pinOtraParada(p.accion, p.estado, p.n), title: p.texto, zIndexOffset: 400 })
        .bindTooltip(p.texto, { direction: 'top', offset: [0, -12], className: 'mapa-etiqueta' })
        .addTo(mapa)
    }
    mapa.fitBounds(trazo.getBounds(), { padding: [60, 60] })

    // Dentro de un modal el contenedor puede cambiar de tamano despues de crearse el mapa.
    const aviso = new ResizeObserver(() => mapa.invalidateSize())
    aviso.observe(lienzo.current)
    const t = setTimeout(() => { mapa.invalidateSize(); mapa.fitBounds(trazo.getBounds(), { padding: [60, 60] }) }, 150)
    return () => { clearTimeout(t); aviso.disconnect(); mapa.remove() }
  }, [ruta, origen, destino, tramo, paradas, rutaSugerida])

  return (
    <div className="mapa-ruta">
      {mostrarLeyenda && <div className="mapa-leyenda">
        <span><i className="mapa-pin origen chico">A</i> {origen}</span>
        <span><i className="mapa-pin destino chico">B</i> {destino}</span>
      </div>}
      {cargando && <div className="mapa-estado" style={{ height: alto }}>Cargando mapa...</div>}
      {error && <div className="mapa-estado error" style={{ height: alto }}>{error}</div>}
      {ruta && (
        <>
          <div ref={lienzo} className="mapa-lienzo" style={{ height: alto }} role="img" aria-label={`Mapa de la ruta de ${origen} a ${destino}`} />
          <p className="mapa-info">
            {rutaSugerida?.length > 1 && <span><b className="leyenda-sugerida" /> Ruta sugerida{mostrarKm ? ' · ' : ''}</span>}
            {tramo?.geometria?.length > 1 && <span><b className="leyenda-tramo" /> Tu tramo <b className="leyenda-resto" /> resto del viaje{mostrarKm ? ' · ' : ''}</span>}
            {mostrarKm
              ? (ruta.aproximada
                ? `Distancia aproximada en línea recta: ${String(ruta.distancia_km).replace('.', ',')} km`
                : `${String(ruta.distancia_km).replace('.', ',')} km · ${formatoDuracion(ruta.duracion_min)} en auto`)
              : ''}
          </p>
        </>
      )}
    </div>
  )
}
