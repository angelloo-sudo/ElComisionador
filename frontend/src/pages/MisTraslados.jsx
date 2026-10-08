import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, BadgeEstado, formatoFecha, Modal, Toast } from '../components/ui.jsx'

function fechaLocal(fecha) {
  return formatoFecha(`${fecha}T12:00:00`)
}

export default function MisTraslados() {
  const [traslados, setTraslados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [trasladoACancelar, setTrasladoACancelar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState('')
  const [toast, setToast] = useState(false)
  const cerrarToast = useCallback(() => setToast(false), [])

  const cargarTraslados = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setTraslados(await api.get('/pasajeros/mis-traslados'))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus traslados.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarTraslados()
  }, [cargarTraslados])

  async function confirmarCancelacion() {
    if (!trasladoACancelar || procesando) return
    setProcesando(true)
    setErrorCancelacion('')
    try {
      await api.patch(
        `/pasajeros/mis-traslados/${trasladoACancelar.viaje_id}/${trasladoACancelar.pasajero_id}/cancelar`,
        {},
      )
      setTrasladoACancelar(null)
      setToast(true)
      await cargarTraslados()
    } catch (err) {
      setErrorCancelacion(err.message || 'No se pudo cancelar el traslado.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Mis traslados</h2>
          <p>Consultá tus reservas y cancelá las que todavía no hayan iniciado.</p>
        </div>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar tus traslados">{error}</Alerta>}

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando tus traslados...</p>
        ) : traslados.length === 0 ? (
          <p className="vacio">Todavía no tenés traslados asociados a tu cuenta.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Recorrido</th>
                <th>Fecha</th>
                <th>Salida</th>
                <th>Pasajero</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {traslados.map((traslado) => (
                <tr key={`${traslado.viaje_id}-${traslado.pasajero_id}`}>
                  <td className="col-recorrido">
                    {traslado.origen}<span className="flecha">→</span>{traslado.destino}
                  </td>
                  <td>{fechaLocal(traslado.fecha)}</td>
                  <td>{traslado.hora_salida ? traslado.hora_salida.slice(0, 5) : '-'}</td>
                  <td>{traslado.pasajero_nombre}</td>
                  <td>
                    {traslado.estado_traslado === 'cancelado'
                      ? <span className="badge punto rojo">Cancelado</span>
                      : <BadgeEstado estado={traslado.estado_viaje} />}
                  </td>
                  <td>
                    {traslado.puede_cancelar && traslado.estado_traslado === 'activo' && (
                      <button
                        type="button"
                        className="btn btn-chico btn-peligro"
                        onClick={() => {
                          setTrasladoACancelar(traslado)
                          setErrorCancelacion('')
                        }}
                      >
                        <Icon nombre="x" tamano={13} /> Cancelar traslado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {trasladoACancelar && (
        <Modal onClose={() => { if (!procesando) setTrasladoACancelar(null) }}>
          <span className="modal-icono"><Icon nombre="alert" tamano={22} /></span>
          <h2>¿Cancelar tu traslado?</h2>
          <p>
            Vas a cancelar el traslado de {trasladoACancelar.pasajero_nombre} para el viaje
            {' '}{trasladoACancelar.origen} → {trasladoACancelar.destino} del{' '}
            {fechaLocal(trasladoACancelar.fecha)}. El asiento reservado quedará disponible.
          </p>
          {errorCancelacion && (
            <Alerta tipo="error" titulo="No se pudo cancelar el traslado">{errorCancelacion}</Alerta>
          )}
          <div className="modal-acciones">
            <button
              type="button"
              className="btn"
              onClick={() => setTrasladoACancelar(null)}
              disabled={procesando}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn btn-peligro"
              onClick={confirmarCancelacion}
              disabled={procesando}
            >
              {procesando ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <Toast
          titulo="Traslado cancelado"
          texto="Tu reserva se canceló y el asiento quedó liberado."
          onClose={cerrarToast}
        />
      )}
    </section>
  )
}
