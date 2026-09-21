// Epica 2: Gestion de Viajes - US10 (registrar) y US12 (consultar).
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.js'
import ViajeFormModal from '../components/viajes/ViajeFormModal.jsx'
import ViajeDetalleModal from '../components/viajes/ViajeDetalleModal.jsx'

const ESTADOS = {
  programado: 'Programado',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export default function Viajes() {
  const [viajes, setViajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [viajeDetalleId, setViajeDetalleId] = useState(null)

  const cargarViajes = useCallback(() => {
    setCargando(true)
    setError(null)
    api.get('/viajes')
      .then(setViajes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargarViajes()
  }, [cargarViajes])

  function handleNuevo() {
    setModalAbierto(true)
  }

  function handleSaved() {
    cargarViajes()
  }

  return (
    <section>
      <h1>Viajes</h1>
      <button onClick={handleNuevo}>+ Nuevo viaje</button>

      {error && <p className="error">{error}</p>}

      {cargando ? (
        <p>Cargando viajes...</p>
      ) : viajes.length === 0 ? (
        <p>Todavía no tenés viajes cargados.</p>
      ) : (
        <table className="tabla-viajes">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Destino</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cupo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viajes.map((viaje) => (
              <tr key={viaje.id}>
                <td>{viaje.origen}</td>
                <td>{viaje.destino}</td>
                <td>{new Date(viaje.fecha).toLocaleDateString('es-AR')}</td>
                <td>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</td>
                <td>{viaje.cupo_total ?? '-'}</td>
                <td>{ESTADOS[viaje.estado] ?? viaje.estado}</td>
                <td>
                  <button onClick={() => setViajeDetalleId(viaje.id)}>Ver detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <ViajeFormModal
          onClose={() => setModalAbierto(false)}
          onSaved={handleSaved}
        />
      )}

      {viajeDetalleId && (
        <ViajeDetalleModal
          viajeId={viajeDetalleId}
          onClose={() => setViajeDetalleId(null)}
        />
      )}
    </section>
  )
}
