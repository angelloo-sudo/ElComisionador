import { formatoFecha } from '../ui.jsx'

const TIPOS = {
  cliente_nuevo: ['Nuevo cliente', 'azul'],
  comisionista_nuevo: ['Nuevo comisionista', 'azul'],
  verificacion_pendiente: ['Verificación pendiente', 'ambar'],
  identidad_aprobada: ['Identidad aprobada', 'verde'],
  identidad_rechazada: ['Identidad rechazada', 'rojo'],
  identidad_corregir: ['Corrección solicitada', 'ambar'],
  viaje_publicado: ['Viaje publicado', 'gris'],
  encomienda_registrada: ['Encomienda registrada', 'gris'],
}

function fechaHora(valor) {
  if (!valor) return 'Fecha no disponible'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? formatoFecha(valor) : fecha.toLocaleString('es-AR')
}

export default function AdminActivityList({ items = [] }) {
  if (!items.length) return <p className="admin-vacio">Todavía no hay movimientos para mostrar.</p>

  return (
    <ol className="admin-actividad-lista">
      {items.map((item, index) => {
        const [etiqueta, tono] = TIPOS[item.tipo] ?? ['Actividad', 'gris']
        return (
          <li className="admin-actividad-item" key={`${item.tipo}-${item.referencia_id}-${item.fecha}-${index}`}>
            <span className={`badge ${tono}`}>{etiqueta}</span>
            <div className="admin-actividad-detalle">
              <strong>{item.sujeto || item.email || 'Actividad del sistema'}</strong>
              <p>{item.detalle}</p>
              {item.email && <small>{item.email}</small>}
              {item.administrador && <small> · Administrador: {item.administrador}</small>}
              {item.motivo && <p className="admin-actividad-motivo">{item.motivo}</p>}
            </div>
            <time dateTime={item.fecha}>{fechaHora(item.fecha) || formatoFecha(item.fecha)}</time>
          </li>
        )
      })}
    </ol>
  )
}
