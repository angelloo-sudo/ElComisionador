// Piezas visuales reutilizables: campo con icono, alerta, aviso emergente, logo.
import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

export function Logo() {
  return (
    <div className="marca">
      <span className="logo-caja"><Icon nombre="logo" tamano={22} /></span>
      <span>ComiTrack</span>
    </div>
  )
}

// Campo de formulario: etiqueta + input con icono + mensaje de error / ayuda.
// "children" es el <input> (o el contenido del input-wrap).
export function Campo({ label, requerido, opcional, icono, error, ayuda, soloLectura, children, className = '' }) {
  return (
    <div className={`campo ${className}`}>
      {label && (
        <label>
          {label}
          {requerido && <span className="req">*</span>}
          {opcional && <span className="opcional"> {opcional}</span>}
        </label>
      )}
      <div className={`input-wrap${error ? ' tiene-error' : ''}${soloLectura ? ' solo-lectura' : ''}`}>
        {icono && <Icon nombre={icono} />}
        {children}
      </div>
      {error && <p className="campo-error"><Icon nombre="alert" tamano={16} />{error}</p>}
      {!error && ayuda && <p className="campo-ayuda">{ayuda}</p>}
    </div>
  )
}

export function CampoPassword({ label, requerido, opcional, error, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  return (
    <Campo label={label} requerido={requerido} opcional={opcional} icono="lock" error={error}>
      <input {...inputProps} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="accion-icono"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon nombre={visible ? 'eyeoff' : 'eye'} />
      </button>
    </Campo>
  )
}

export function Alerta({ tipo = 'error', titulo, children, onCerrar }) {
  return (
    <div className={`alerta ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icon nombre={tipo === 'aviso' ? 'warning' : tipo === 'exito' ? 'checkcircle' : 'alert'} tamano={20} />
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children && <p>{children}</p>}
      </div>
      {onCerrar && (
        <button type="button" className="alerta-cerrar" aria-label="Cerrar aviso" onClick={onCerrar}><Icon nombre="x" tamano={16} /></button>
      )}
    </div>
  )
}

// Aviso verde arriba a la derecha; se cierra solo.
export function Toast({ titulo, texto, onClose, ms = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [onClose, ms])
  return (
    <div className="toast" role="status">
      <Icon nombre="checkcircle" tamano={22} />
      <div>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </div>
    </div>
  )
}

export function Modal({ children, onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

export const ESTADOS_VIAJE = {
  programado: { texto: 'Programado', clase: 'azul' },
  en_curso: { texto: 'En curso', clase: 'ambar' },
  finalizado: { texto: 'Finalizado', clase: 'verde' },
  cancelado: { texto: 'Cancelado', clase: 'rojo' },
}

export function BadgeEstado({ estado }) {
  const e = ESTADOS_VIAJE[estado] ?? { texto: estado, clase: 'gris' }
  return <span className={`badge punto ${e.clase}`}>{e.texto}</span>
}

export function formatoFecha(valor) {
  return new Date(valor).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Los viajes repetitivos no tienen fecha de fin: siguen hasta que el comisionista los cancele.
export function textoRepeticion(valor, serieId) {
  if (!valor) return serieId ? 'Serie cancelada' : 'Viaje único'
  const dias = valor === 'todos'
    ? 'Todos los días'
    : 'Todos los ' + valor.split(',').map((d) => DIAS_CORTOS[Number(d)]).join(', ')
  return `${dias} · hasta cancelarlo`
}
