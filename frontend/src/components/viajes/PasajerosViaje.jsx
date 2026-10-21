// US22 / US24 / US25 - Pasajeros aceptados de un viaje y su avance: a bordo, en destino, ausente o cancelado.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export const ESTADOS_PASAJERO = {
  a_bordo: { texto: 'A bordo', clase: 'verde' },
  en_destino: { texto: 'En destino', clase: 'verde' },
  ausente: { texto: 'Ausente', clase: 'ambar' },
  cancelado_comisionista: { texto: 'Cancelado por el comisionista', clase: 'gris' },
}

export function BadgePasajero({ estado }) {
  const e = ESTADOS_PASAJERO[estado]
  if (!e) return <span className="badge punto gris">Sin subir</span>
  return <span className={`badge punto ${e.clase}`}>{e.texto}</span>
}

const hora = (v) => new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function PasajerosViaje({ viajeId, estadoViaje, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [aviso, setAviso] = useState('')
  const [confirmar, setConfirmar] = useState(null) // id del pasajero a cancelar

  const cargar = useCallback(() => {
    api.get(`/viajes/${viajeId}/pasajeros`).then(setDatos).catch((e) => setError(e.message))
  }, [viajeId])
  useEffect(() => { cargar() }, [cargar, estadoViaje])

  async function cambiar(p, estado) {
    setProcesando(p.id); setError(''); setConfirmar(null)
    try {
      const r = await api.patch(`/solicitudes/${p.id}/pasajero`, { estado })
      setAviso(r.ingreso ? `Cobro registrado: $${Number(r.ingreso.monto).toLocaleString('es-AR')}` : '')
      onCambio?.()
    } catch (e) { setError(e.message || 'No se pudo actualizar al pasajero.') }
    finally { setProcesando(null); cargar() }
  }

  // Los botones se habilitan recien cuando el viaje esta en curso.
  const enCurso = (datos?.estado_viaje ?? estadoViaje) === 'en_curso'
  const editable = enCurso
  const esperandoInicio = (datos?.estado_viaje ?? estadoViaje) === 'programado'

  return (
    <div>
      <h3 style={{ marginTop: 18 }}>Pasajeros aceptados</h3>
      {esperandoInicio && datos?.pasajeros.length > 0 && <p className="campo-ayuda">Iniciá el viaje para poder registrar la subida, ausencia o llegada de los pasajeros.</p>}
      {error && <p className="campo-error">{error}</p>}
      {aviso && <p className="campo-ayuda" style={{ color: 'var(--ok, #2f7d4f)' }}>{aviso}</p>}
      {!datos ? <p className="campo-ayuda">Cargando...</p> : datos.pasajeros.length === 0 ? (
        <p className="campo-ayuda">Todavía no hay reservas activas para este viaje.</p>
      ) : (
        <ul className="lista-pasajeros" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 10 }}>
          {datos.pasajeros.map((p) => (
            <li key={p.id} style={{ border: '1px solid var(--borde, #e5d9d2)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{p.nombre} {p.apellido}{p.cantidad_pasajeros > 1 ? ` (${p.cantidad_pasajeros} pasajeros)` : ''}</strong>
                <BadgePasajero estado={p.estado_pasajero} />
              </div>
              <div className="campo-ayuda">
                {p.origen_localidad && p.destino_localidad ? `${p.origen_localidad} → ${p.destino_localidad}` : ''}
                {p.subio_en && p.estado_pasajero !== 'ausente' ? ` · Subió ${hora(p.subio_en)}` : ''}
                {p.llego_en ? ` · Llegó ${hora(p.llego_en)}` : ''}
                {p.cobrado ? ' · Cobrado' : ''}
              </div>
              {editable && (
                <div className="acciones-fila" style={{ marginTop: 8 }}>
                  {!p.estado_pasajero && (
                    <>
                      <button type="button" className="btn btn-chico btn-primario" disabled={procesando === p.id} onClick={() => cambiar(p, 'a_bordo')}>Subió</button>
                      <button type="button" className="btn btn-chico" disabled={procesando === p.id} onClick={() => cambiar(p, 'ausente')}>Ausente</button>
                      {confirmar === p.id
                        ? <button type="button" className="btn btn-chico btn-peligro" disabled={procesando === p.id} onClick={() => cambiar(p, 'cancelado_comisionista')}>Confirmar cancelación</button>
                        : <button type="button" className="btn btn-chico btn-peligro" onClick={() => setConfirmar(p.id)}>Cancelar pasajero</button>}
                    </>
                  )}
                  {p.estado_pasajero === 'a_bordo' && (
                    <>
                      <button type="button" className="btn btn-chico btn-primario" disabled={procesando === p.id || !enCurso}
                        title={enCurso ? undefined : 'Iniciá el viaje para registrar la llegada'} onClick={() => cambiar(p, 'en_destino')}>Llegó a destino</button>
                      <button type="button" className="btn btn-chico" disabled={procesando === p.id} onClick={() => cambiar(p, 'pendiente')}>Deshacer</button>
                    </>
                  )}
                  {p.estado_pasajero === 'ausente' && (
                    <button type="button" className="btn btn-chico" disabled={procesando === p.id} onClick={() => cambiar(p, 'pendiente')}>Deshacer</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
