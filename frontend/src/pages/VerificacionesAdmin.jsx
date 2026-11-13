import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, formatoFecha } from '../components/ui.jsx'
import { formatearEstadoVerificacion } from '../utils/verificacion.js'
import '../styles/verificacion.css'

const FILTROS = [
  ['PENDIENTE_REVISION', 'Pendientes'],
  ['APROBADA_MANUALMENTE', 'Aceptadas'],
  ['RECHAZADA', 'Rechazadas'],
  ['REQUIERE_CORRECCION', 'Requieren corrección'],
]

function Indicador({ valor }) {
  const texto = valor === true ? 'Coincide' : valor === false ? 'Diferencia' : 'Sin dato'
  return <span className={`verif-indicador ${valor === true ? 'si' : valor === false ? 'no' : ''}`}>{texto}</span>
}

export default function VerificacionesAdmin() {
  const [estado, setEstado] = useState('PENDIENTE_REVISION')
  const [solicitudes, setSolicitudes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function cargar(filtro = estado) {
    setCargando(true)
    setError('')
    try {
      const resultado = await api.get(`/verificaciones/admin?estado=${encodeURIComponent(filtro)}`)
      setSolicitudes(resultado)
    } catch (e) { setError(e.message || 'No se pudieron cargar las verificaciones.') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar(estado) }, [estado])

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLocaleLowerCase('es-AR')
    if (!term) return solicitudes
    return solicitudes.filter((s) => `${s.nombre} ${s.apellido || ''} ${s.email} ${s.rol}`.toLocaleLowerCase('es-AR').includes(term))
  }, [solicitudes, busqueda])

  function prepararAccion(id, decision) {
    setAccion({ id, decision })
    setMotivo('')
    setConfirmar(false)
    setAviso('')
  }

  async function resolver() {
    if (!accion) return
    if (accion.decision !== 'APROBADA_MANUALMENTE' && motivo.trim().length < 3) {
      setError('Escribí un motivo de al menos 3 caracteres.')
      return
    }
    if (accion.decision === 'APROBADA_MANUALMENTE' && !confirmar) {
      setError('Confirmá que entendés el alcance preliminar antes de aprobar.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      await api.patch(`/verificaciones/admin/${accion.id}/resolver`, {
        decision: accion.decision,
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      })
      setAccion(null)
      setAviso('La decisión quedó registrada con tu usuario y fecha.')
      await cargar()
    } catch (e) { setError(e.message || 'No se pudo guardar la decisión.') }
    finally { setGuardando(false) }
  }

  return (
    <section className="verif-pagina verif-admin">
      <header className="verif-encabezado">
        <p className="auth-kicker">Administración</p>
        <h2>Revisión de identidad</h2>
        <p>Revisá los la lectura del código y coincidencia con el perfil. El sistema no certifica la identidad ni la autenticidad del DNI.</p>
      </header>
      {error && <Alerta tipo="error" titulo="No se pudo completar la acción">{error}</Alerta>}
      {aviso && <Alerta tipo="exito" titulo="Decisión guardada">{aviso}</Alerta>}

      <div className="verif-admin-controles">
        <div className="verif-tabs" role="tablist" aria-label="Filtrar solicitudes">
          {FILTROS.map(([valor, texto]) => <button key={valor} role="tab" aria-selected={estado === valor} className={estado === valor ? 'activo' : ''} onClick={() => { setEstado(valor); setAccion(null) }}>{texto}</button>)}
        </div>
        <label className="verif-busqueda">Buscar por usuario<input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, apellido, correo o rol" /></label>
      </div>

      {cargando && <p className="campo-ayuda">Cargando solicitudes…</p>}
      {!cargando && filtradas.length === 0 && <div className="card verif-vacio"><h3>No hay solicitudes en este filtro</h3><p>{busqueda ? 'Probá con otro nombre o correo.' : 'Cuando haya solicitudes, aparecerán en esta lista.'}</p></div>}

      <div className="verif-admin-lista">
        {filtradas.map((s) => (
          <article className="card verif-admin-card" key={s.id}>
            <div className="card-cabecera">
              <div><h3>{s.nombre} {s.apellido || ''}</h3><p>{s.email} · {s.rol === 'comisionista' ? 'Comisionista' : 'Cliente'}</p></div>
              <span className={`verif-pill ${s.estado === 'PENDIENTE_REVISION' ? 'pendiente' : s.estado === 'APROBADA_MANUALMENTE' ? 'exito' : 'atencion'}`}>{formatearEstadoVerificacion(s.estado)}</span>
            </div>

            <div className="verif-admin-meta">
              <span>Iniciada {formatoFecha(s.iniciada_en)}</span>
              {s.enviada_en && <span>Enviada {formatoFecha(s.enviada_en)}</span>}
              <span>DNI de cuenta {s.dni_cuenta_parcial || 'No registrado'}</span>
            </div>

            <div className="verif-admin-resultados">
              <section><h4>Lectura PDF417</h4><p>{s.resultado_ocr === 'legible' ? 'Código leído; datos coincidentes' : s.resultado_ocr === 'no_legible' ? 'No se pudo leer el código' : 'Lectura incompleta'}</p><small>Se conserva solo el DNI parcial y el resultado de la comparación.</small></section>
              <section><h4>Comparación con el perfil</h4><ul>{['nombre', 'apellido', 'dni'].map((campo) => <li key={campo}><span>{campo[0].toUpperCase() + campo.slice(1)}</span><Indicador valor={s.coincidencias?.[campo]} /></li>)}</ul></section>
            </div>

            {s.motivo_resolucion && <div className="verif-observacion"><strong>Observación de resolución</strong><p>{s.motivo_resolucion}</p><small>Resuelta {s.resuelta_en ? formatoFecha(s.resuelta_en) : ''}{s.resuelta_por ? ` · Administrador #${s.resuelta_por}` : ''}</small></div>}

            {s.estado === 'PENDIENTE_REVISION' && <div className="verif-admin-acciones">
              {accion?.id === s.id ? (
                <div className="verif-resolver">
                  <div><strong>{accion.decision === 'APROBADA_MANUALMENTE' ? 'Aprobar solicitud de identidad' : accion.decision === 'RECHAZADA' ? 'Rechazar solicitud' : 'Solicitar corrección'}</strong>
                    {accion.decision === 'APROBADA_MANUALMENTE'
                      ? <label className="check-linea"><input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} /><span>Entiendo que esta decisión se basa en la lectura y coincidencia del código y no certifica oficialmente la identidad.</span></label>
                      : <label className="verif-motivo">Explicación para el usuario<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} placeholder="Describí qué debe corregir o por qué se rechaza (3 a 500 caracteres)." /></label>}
                  </div>
                  <div className="verif-botones"><button className="btn" type="button" onClick={() => setAccion(null)} disabled={guardando}>Cancelar</button><button className="btn btn-primario" type="button" onClick={resolver} disabled={guardando}>{guardando ? 'Guardando…' : 'Confirmar decisión'}</button></div>
                </div>
              ) : (
                <div className="verif-botones"><button className="btn" type="button" onClick={() => prepararAccion(s.id, 'REQUIERE_CORRECCION')}>Solicitar corrección</button><button className="btn" type="button" onClick={() => prepararAccion(s.id, 'RECHAZADA')}>Rechazar</button><button className="btn btn-primario" type="button" onClick={() => prepararAccion(s.id, 'APROBADA_MANUALMENTE')}>Aceptar solicitud de identidad</button></div>
              )}
            </div>}
          </article>
        ))}
      </div>
    </section>
  )
}
