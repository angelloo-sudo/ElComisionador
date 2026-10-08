import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, BadgeEstado, formatoFecha, Modal, Toast } from '../components/ui.jsx'

function fechaLocal(fecha) {
  return formatoFecha(`${fecha}T12:00:00`)
}

export default function MisTraslados() {
  const [traslados, setTraslados] = useState([])
  const [viajesDisponibles, setViajesDisponibles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [viajeAReservar, setViajeAReservar] = useState(null)
  const [trasladoACancelar, setTrasladoACancelar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [errorReserva, setErrorReserva] = useState('')
  const [errorCancelacion, setErrorCancelacion] = useState('')
  const [toast, setToast] = useState(false)
  const cerrarToast = useCallback(() => setToast(false), [])

  const cargarTraslados = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const [reservas, disponibles] = await Promise.all([
        api.get('/pasajeros/mis-traslados'),
        api.get('/pasajeros/viajes-disponibles'),
      ])
      setTraslados(reservas)
      setViajesDisponibles(disponibles)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los viajes.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarTraslados()
  }, [cargarTraslados])

  async function confirmarReserva() {
    if (!viajeAReservar || procesando) return
    setProcesando(true)
    setErrorReserva('')
    try {
      await api.post(`/pasajeros/viajes/${viajeAReservar.viaje_id}/reservar`, {})
      setViajeAReservar(null)
      setToast('reserva')
      await cargarTraslados()
    } catch (err) {
      setErrorReserva(err.message || 'No se pudo reservar el viaje.')
    } finally {
      setProcesando(false)
    }
  }

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
      setToast('cancelacion')
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
          <p>Encontrá viajes disponibles, reservá tu lugar y administrá tus traslados.</p>
        </div>
      </div>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los viajes">{error}</Alerta>}

      <div className="card">
        <div className="card-cabecera">
          <div>
            <h2>Viajes disponibles</h2>
            <p>Viajes programados con lugares disponibles.</p>
          </div>
        </div>
        <div className="tabla-wrap">
          {cargando ? (
            <p className="vacio">Cargando viajes...</p>
          ) : viajesDisponibles.length === 0 ? (
            <p className="vacio">No hay viajes programados con cupos disponibles en este momento.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Recorrido</th>
                  <th>Fecha</th>
                  <th>Salida</th>
                  <th>Comisionista</th>
                  <th>Cupos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {viajesDisponibles.map((viaje) => (
                  <tr key={viaje.viaje_id}>
                    <td className="col-recorrido">
                      {viaje.origen}<span className="flecha">→</span>{viaje.destino}
                    </td>
                    <td>{fechaLocal(viaje.fecha)}</td>
                    <td>{viaje.hora_salida ? viaje.hora_salida.slice(0, 5) : '-'}</td>
                    <td>{`${viaje.comisionista_nombre} ${viaje.comisionista_apellido ?? ''}`.trim()}</td>
                    <td>{viaje.cupos_disponibles} / {viaje.cupo_total}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-chico btn-primario"
                        onClick={() => {
                          setViajeAReservar(viaje)
                          setErrorReserva('')
                        }}
                      >
                        <Icon nombre="seat" tamano={13} /> Reservar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card tabla-wrap" style={{ marginTop: 20 }}>
        <div className="card-cabecera">
          <div>
            <h2>Mis reservas</h2>
            <p>Consultá el estado de tus traslados y cancelá los que todavía no iniciaron.</p>
          </div>
        </div>
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

      {viajeAReservar && (
        <Modal onClose={() => { if (!procesando) setViajeAReservar(null) }}>
          <span className="modal-icono"><Icon nombre="seat" tamano={22} /></span>
          <h2>¿Confirmar tu reserva?</h2>
          <p>
            Te vas a sumar al viaje {viajeAReservar.origen} → {viajeAReservar.destino} del{' '}
            {fechaLocal(viajeAReservar.fecha)} a las{' '}
            {viajeAReservar.hora_salida ? viajeAReservar.hora_salida.slice(0, 5) : '00:00'}.
            {' '}Quedan {viajeAReservar.cupos_disponibles} cupo(s) disponibles.
          </p>
          {errorReserva && <Alerta tipo="error" titulo="No se pudo reservar">{errorReserva}</Alerta>}
          <div className="modal-acciones">
            <button
              type="button"
              className="btn"
              onClick={() => setViajeAReservar(null)}
              disabled={procesando}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn btn-primario"
              onClick={confirmarReserva}
              disabled={procesando}
            >
              {procesando ? 'Reservando...' : 'Confirmar reserva'}
            </button>
          </div>
        </Modal>
      )}

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
          titulo={toast === 'reserva' ? 'Viaje reservado' : 'Traslado cancelado'}
          texto={toast === 'reserva'
            ? 'Tu lugar quedó reservado. Encontrarás el viaje en Mis reservas.'
            : 'Tu reserva se canceló y el asiento quedó liberado.'}
          onClose={cerrarToast}
        />
      )}
    </section>
  )
}
