import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client.js'
import { Alerta } from '../ui.jsx'

function ubicacion(localidad, calle, altura) {
  const direccion = [calle, altura].filter(Boolean).join(' ')
  return [localidad, direccion].filter(Boolean).join(' · ') || 'No informada'
}

function estadoEncomienda(encomienda) {
  if (encomienda.entregada_en) return { texto: 'Entregada', clase: 'verde' }
  if (encomienda.retirada_en) return { texto: 'Retirada', clase: 'azul' }
  return { texto: 'Pendiente de retiro', clase: 'ambar' }
}

export default function EncomiendasViaje({ viajeId, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [aviso, setAviso] = useState('')
  const bloquearAccion = useRef(false)

  const cargar = useCallback(async () => {
    try {
      const resultado = await api.get(`/viajes/${viajeId}/encomiendas`)
      setDatos(resultado)
      setError('')
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las encomiendas del viaje.')
    }
  }, [viajeId])

  useEffect(() => { cargar() }, [cargar])

  async function cambiar(encomienda, accion) {
    if (bloquearAccion.current) return
    bloquearAccion.current = true
    setProcesando(encomienda.id)
    setError('')
    setAviso('')
    try {
      const resultado = await api.patch(`/solicitudes/${encomienda.id}/${accion}`, {})
      setAviso(accion === 'retirar'
        ? 'Retiro registrado. El ingreso se registrará al marcar la entrega.'
        : resultado.ingreso
          ? `Entrega registrada. Ingreso de $${Number(resultado.ingreso.monto).toLocaleString('es-AR')}.`
          : Number(encomienda.monto) > 0
            ? 'Entrega registrada. El ingreso ya estaba activo y no se duplicó.'
            : 'Entrega registrada. No hay un monto definido para generar el ingreso.')
      onCambio?.()
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado de la encomienda.')
    } finally {
      await cargar()
      bloquearAccion.current = false
      setProcesando(null)
    }
  }

  return (
    <section>
      <h3 style={{ marginTop: 18 }}>Encomiendas del viaje</h3>
      {error && <Alerta tipo="error" titulo="No se pudo actualizar o cargar la encomienda">{error}</Alerta>}
      {aviso && <Alerta tipo="exito" titulo="Estado actualizado">{aviso}</Alerta>}
      {!datos ? <p className="campo-ayuda">Cargando...</p> : datos.encomiendas.length === 0 ? (
        <p className="campo-ayuda">Todavía no hay encomiendas aceptadas para este viaje.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 10 }}>
          {datos.encomiendas.map((encomienda) => {
            const estado = estadoEncomienda(encomienda)
            const puedeRetirar = !encomienda.retirada_en && datos.estado_viaje === 'en_curso'
            const puedeEntregar = Boolean(encomienda.retirada_en) && !encomienda.entregada_en && datos.estado_viaje !== 'cancelado'
            return (
              <li key={encomienda.id} style={{ border: '1px solid var(--borde, #e5d9d2)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>Encomienda #{encomienda.id} · {encomienda.emisor_nombre} {encomienda.emisor_apellido}</strong>
                  <span className={`badge punto ${estado.clase}`}>{estado.texto}</span>
                </div>
                <div className="campo-ayuda">
                  Destinatario: {encomienda.receptor_nombre} {encomienda.receptor_apellido}
                  <br />Retiro: {ubicacion(encomienda.origen_localidad, encomienda.origen_calle, encomienda.origen_altura)}
                  <br />Entrega: {ubicacion(encomienda.destino_localidad, encomienda.destino_calle, encomienda.destino_altura)}
                </div>
                {(puedeRetirar || puedeEntregar) && (
                  <div className="acciones-fila" style={{ marginTop: 8 }}>
                    {puedeRetirar && (
                      <button type="button" className="btn btn-chico btn-primario" disabled={Boolean(procesando)}
                        onClick={() => cambiar(encomienda, 'retirar')}>
                        {procesando === encomienda.id ? 'Guardando...' : 'Marcar retirada'}
                      </button>
                    )}
                    {puedeEntregar && (
                      <button type="button" className="btn btn-chico btn-primario" disabled={Boolean(procesando)}
                        onClick={() => cambiar(encomienda, 'entregar')}>
                        {procesando === encomienda.id ? 'Guardando...' : 'Marcar entregada'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
