// Piezas visuales reutilizables: campo con icono, alerta, aviso emergente, logo.
import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { estadoVisibleViaje } from '../utils/estadoViaje.js'

// Mascota de ComiTrack: camioncito chibi con la cara en el parabrisas (parpadea, rebota y gira las ruedas).
export function Mascota({ ancho = 62, className = '' }) {
  return (
    <svg className={`mascota ${className}`} width={ancho} height={Math.round(ancho * 0.75)} viewBox="0 0 64 48" role="img" aria-label="Mascota de ComiTrack">
      <ellipse className="sombra-mascota" cx="32" cy="45.5" rx="26" ry="2" />
      <g className="cuerpo-mascota">
        <rect className="m-caja" x="2" y="8" width="34" height="28" rx="6" />
        <rect className="m-raya" x="7" y="14" width="24" height="3" rx="1.5" />
        <rect className="m-raya" x="7" y="20" width="16" height="3" rx="1.5" />
        <path className="m-cabina" d="M34 14h14c4 0 6 2 8 5l5 7c1 1.4 1.5 2.6 1.5 4V33a3 3 0 0 1-3 3H34z" />
        <path className="m-parabrisas" d="M38 17.5h10.5c2 0 3.3.9 4.3 2.4l3 5.1H38z" />
        <ellipse className="m-ojo" cx="43" cy="21.6" rx="2.4" ry="3" />
        <ellipse className="m-ojo" cx="51" cy="22" rx="2" ry="2.7" />
        <circle className="m-brillo" cx="43.8" cy="20.4" r=".9" />
        <circle className="m-brillo" cx="51.6" cy="20.9" r=".8" />
        <circle className="m-faro" cx="60" cy="30" r="2" />
        <g className="m-rueda">
          <circle className="m-llanta" cx="14" cy="37" r="6.5" />
          <circle className="m-centro" cx="14" cy="37" r="2.4" />
          <path className="m-rayo" d="M14 31.5v11M8.5 37h11" />
        </g>
        <g className="m-rueda">
          <circle className="m-llanta" cx="49" cy="37" r="6.5" />
          <circle className="m-centro" cx="49" cy="37" r="2.4" />
          <path className="m-rayo" d="M43.5 37h11M49 31.5v11" />
        </g>
      </g>
    </svg>
  )
}

export function Logo() {
  return (
    <div className="marca">
      <Mascota />
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
  vencido: { texto: 'Vencido', clase: 'ambar' },
}

export function BadgeEstado({ estado, fecha, ahora }) {
  const estadoVisible = estadoVisibleViaje(estado, fecha, ahora)
  const e = ESTADOS_VIAJE[estadoVisible] ?? { texto: estadoVisible, clase: 'gris' }
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
