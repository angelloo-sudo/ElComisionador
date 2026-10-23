// US12 - Detalle de consulta de un viaje puntual.
// Ventana ancha en dos columnas: a la izquierda el detalle y a la derecha el mapa con la ruta.
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../api/client.js'
import { Modal, Alerta, BadgeEstado, formatoFecha, textoRepeticion } from '../ui.jsx'
import MapaRuta from '../MapaRuta.jsx'
import PasajerosViaje from './PasajerosViaje.jsx'
import ParadasViaje, { pinesDeParadas } from './ParadasViaje.jsx'
import { codigoViaje } from '../../pages/ViajeNuevo.jsx'
import { estadoVisibleViaje, puedeIniciarViaje } from '../../utils/estadoViaje.js'
import { calcularMonto, formatoDuracion, formatoKm, formatoPesos } from '../../utils/tarifa.js'

function formatoFechaHora(valor) {
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ViajeDetalleModal({ viajeId, onClose, onCancelar, onModificar, onIniciar, onFinalizar, ahora }) {
  const [viaje, setViaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [paradas, setParadas] = useState(null) // { paradas, sugerencia }
  const [verSugerida, setVerSugerida] = useState(false)
  const [recordatorio, setRecordatorio] = useState(null)
  const [quiereRecordatorio, setQuiereRecordatorio] = useState(false)
  const [anticipacion, setAnticipacion] = useState('60')
  const [guardandoRecordatorio, setGuardandoRecordatorio] = useState(false)
  const [avisoRecordatorio, setAvisoRecordatorio] = useState(null)

  const recargar = () => {
    api.get(`/viajes/${viajeId}`).then(setViaje).catch(() => {})
    api.get(`/viajes/${viajeId}/paradas`).then(setParadas).catch(() => {})
  }

  useEffect(() => {
    setCargando(true)
    setError(null)
    setRecordatorio(null)
    setQuiereRecordatorio(false)
    setAnticipacion('60')
    setAvisoRecordatorio(null)
    api.get(`/viajes/${viajeId}`)
      .then(setViaje)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
    setParadas(null); setVerSugerida(false)
    api.get(`/viajes/${viajeId}/paradas`).then(setParadas).catch(() => setParadas(null)) // si falla, el detalle se ve igual
    api.get(`/viajes/${viajeId}/recordatorio`).then(({ recordatorio: r }) => {
      setRecordatorio(r)
      setQuiereRecordatorio(Boolean(r))
      if (r?.minutos_anticipacion) setAnticipacion(String(r.minutos_anticipacion))
    }).catch(() => { setRecordatorio(null); setQuiereRecordatorio(false) })
  }, [viajeId])

  async function guardarRecordatorio(event) {
    event.preventDefault()
    setGuardandoRecordatorio(true)
    setAvisoRecordatorio(null)
    try {
      if (!quiereRecordatorio) {
        if (!recordatorio) return
        const respuesta = await api.del(`/viajes/${viajeId}/recordatorio`)
        setRecordatorio(null)
        setAvisoRecordatorio({ tipo: 'exito', texto: respuesta.mensaje })
        return
      }
      const respuesta = await api.put(`/viajes/${viajeId}/recordatorio`, { minutos_anticipacion: Number(anticipacion) })
      setRecordatorio(respuesta.recordatorio)
      setAvisoRecordatorio({ tipo: 'exito', texto: respuesta.mensaje })
    } catch (err) {
      setAvisoRecordatorio({ tipo: 'error', texto: err.message })
    } finally {
      setGuardandoRecordatorio(false)
    }
  }

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
            {viaje.iniciado_en && <div className="resumen-fila"><span>Iniciado</span><strong>{formatoFechaHora(viaje.iniciado_en)}</strong></div>}
            {viaje.finalizado_en && <div className="resumen-fila"><span>Finalizado</span><strong>{formatoFechaHora(viaje.finalizado_en)}</strong></div>}
            <div className="resumen-fila"><span>Creado</span><strong>{formatoFecha(viaje.creado_en)}</strong></div>
            {viaje.estado === 'programado' && (
              <form className="card" onSubmit={guardarRecordatorio} style={{ margin: '16px 0', padding: 16 }}>
                <h3>Recordatorio del viaje</h3>
                <label className="campo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={quiereRecordatorio} onChange={(e) => setQuiereRecordatorio(e.target.checked)} />
                  <span>Quiero recibir un recordatorio por correo</span>
                </label>
                {quiereRecordatorio && (
                  <>
                    <p className="campo-ayuda">Si no marcás esta opción, no programamos ningún aviso.</p>
                    <label className="campo" style={{ marginTop: 10 }}>
                      <span>Anticipación</span>
                      <select value={anticipacion} onChange={(e) => setAnticipacion(e.target.value)}>
                        <option value="15">15 minutos</option>
                        <option value="30">30 minutos</option>
                        <option value="60">1 hora</option>
                        <option value="120">2 horas</option>
                        <option value="360">6 horas</option>
                        <option value="720">12 horas</option>
                        <option value="1440">1 día</option>
                        <option value="10080">7 días</option>
                      </select>
                    </label>
                  </>
                )}
                {recordatorio && quiereRecordatorio && <p className="campo-ayuda">Configurado: {recordatorio.minutos_anticipacion} minutos antes.</p>}
                {avisoRecordatorio && <Alerta tipo={avisoRecordatorio.tipo} titulo={avisoRecordatorio.tipo === 'exito' ? 'Recordatorio guardado' : 'No se pudo guardar'}>{avisoRecordatorio.texto}</Alerta>}
                {(quiereRecordatorio || recordatorio) && (
                  <button type="submit" className="btn btn-primario" disabled={guardandoRecordatorio}>
                    {guardandoRecordatorio ? 'Guardando...' : quiereRecordatorio ? recordatorio ? 'Actualizar recordatorio' : 'Guardar recordatorio' : 'Desactivar recordatorio'}
                  </button>
                )}
              </form>
            )}
            <ParadasViaje datos={paradas} verSugerida={verSugerida} onVerSugerida={setVerSugerida} />
            <PasajerosViaje viajeId={viaje.id} estadoViaje={viaje.estado} onCambio={recargar} />
          </div>
          <div className="detalle-mapa">
            <MapaRuta origen={viaje.origen} destino={viaje.destino} alto={460}
              paradas={pines} rutaSugerida={geometriaSugerida} mostrarKm={!verSugerida} />
          </div>
        </div>
      )}

      <div className="modal-acciones">
        {viaje && onIniciar && puedeIniciarViaje(viaje, ahora) && (
          <button type="button" className="btn btn-primario" onClick={() => onIniciar(viaje)}>Iniciar viaje</button>
        )}
        {viaje && onFinalizar && viaje.estado === 'en_curso' && (
          <button type="button" className="btn btn-primario" onClick={() => onFinalizar(viaje)}>Finalizar viaje</button>
        )}
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
