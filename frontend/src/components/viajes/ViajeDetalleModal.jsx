// US12 - Detalle de consulta de un viaje puntual.
// Ventana ancha en dos columnas: a la izquierda el detalle y a la derecha el mapa con la ruta.
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../api/client.js'
import { Modal, Alerta, BadgeEstado, formatoFecha, textoRepeticion } from '../ui.jsx'
import MapaRuta from '../MapaRuta.jsx'
import ParadasViaje, { pinesDeParadas } from './ParadasViaje.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'
import { estadoVisibleViaje } from '../../utils/estadoViaje.js'
import { calcularMonto, formatoDuracion, formatoKm, formatoPesos } from '../../utils/tarifa.js'

export default function ViajeDetalleModal({ viajeId, onClose, onCancelar, onModificar, ahora }) {
  const [viaje, setViaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [paradas, setParadas] = useState(null) // { paradas, sugerencia }
  const [verSugerida, setVerSugerida] = useState(false)

  useEffect(() => {
    setCargando(true)
    setError(null)
    api.get(`/viajes/${viajeId}`)
      .then(setViaje)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
    setParadas(null); setVerSugerida(false)
    api.get(`/viajes/${viajeId}/paradas`).then(setParadas).catch(() => setParadas(null)) // si falla, el detalle se ve igual
  }, [viajeId])

  const pines = useMemo(() => pinesDeParadas(paradas, verSugerida), [paradas, verSugerida])
  const geometriaSugerida = verSugerida ? paradas?.sugerencia?.geometria : null
  const precioPasajero = viaje ? calcularMonto({ precioKm: viaje.precio_km, distanciaKm: viaje.distancia_km }) : null

  return (
    <Modal onClose={onClose} ancho="extra">
      <h2>Detalle del viaje{viaje ? ` ${codigoViaje(viaje.id)}` : ''}</h2>

      {cargando && <p>Cargando...</p>}
      {error && <Alerta tipo="error" titulo="No se pudo cargar el viaje">{error}</Alerta>}

      {viaje && (
        <div className="detalle-2col">
          <div className="viaje-detalle">
            <div className="resumen-fila"><span>Origen</span><strong>{viaje.origen}</strong></div>
            <div className="resumen-fila"><span>Destino</span><strong>{viaje.destino}</strong></div>
            <div className="resumen-fila"><span>Fecha</span><strong>{formatoFecha(viaje.fecha)}</strong></div>
            <div className="resumen-fila"><span>Hora de salida</span><strong>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</strong></div>
            <div className="resumen-fila"><span>Duración</span><strong>{formatoDuracion(viaje.duracion_min)}</strong></div>
            <div className="resumen-fila"><span>Distancia</span><strong>{formatoKm(viaje.distancia_km)}</strong></div>
            <div className="resumen-fila"><span>Hora de llegada (aprox.)</span><strong>{viaje.hora_llegada ? viaje.hora_llegada.slice(0, 5) : '-'}</strong></div>
            <div className="resumen-fila"><span>Tu precio por km</span><strong>{viaje.precio_km ? formatoPesos(viaje.precio_km) : 'Sin configurar'}</strong></div>
            <div className="resumen-fila"><span>Precio por pasajero</span><strong>{formatoPesos(precioPasajero)}</strong></div>
            <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion(viaje.repeticion_dias, viaje.serie_id)}</strong></div>
            <div className="resumen-fila"><span>Cupo de pasajeros</span><strong>{viaje.ocupados} / {viaje.cupo_total ?? '-'}</strong></div>
            <div className="resumen-fila"><span>Estado</span><BadgeEstado estado={viaje.estado} fecha={viaje.fecha} ahora={ahora} /></div>
            <div className="resumen-fila"><span>Creado</span><strong>{formatoFecha(viaje.creado_en)}</strong></div>
            <ParadasViaje datos={paradas} verSugerida={verSugerida} onVerSugerida={setVerSugerida} />
            <h3 style={{ marginTop: 18 }}>Pasajeros aceptados</h3>
            {viaje.pasajeros.length === 0 ? (
              <p className="campo-ayuda">Todavía no hay reservas activas para este viaje.</p>
            ) : (
              <ul style={{ margin: '12px 0 0', paddingLeft: 22 }}>
                {viaje.pasajeros.map((nombre, indice) => <li key={`${nombre}-${indice}`}>{nombre}</li>)}
              </ul>
            )}
          </div>
          <div className="detalle-mapa">
            <MapaRuta origen={viaje.origen} destino={viaje.destino} alto={460}
              paradas={pines} rutaSugerida={geometriaSugerida} mostrarKm={!verSugerida} />
          </div>
        </div>
      )}

      <div className="modal-acciones">
        {viaje && estadoVisibleViaje(viaje.estado, viaje.fecha, ahora) === 'programado' && onModificar && (
          <button type="button" className="btn" onClick={() => onModificar(viaje)}>Modificar viaje</button>
        )}
        {viaje && estadoVisibleViaje(viaje.estado, viaje.fecha, ahora) === 'programado' && onCancelar && (
          <button type="button" className="btn btn-peligro" onClick={() => onCancelar(viaje)}>Cancelar viaje</button>
        )}
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
