import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, Modal, formatoFecha } from '../components/ui.jsx'
import '../styles/admin.css'

const ESTADOS_IDENTIDAD = {
  NO_INICIADA: ['No iniciada', 'gris'],
  EN_PROCESO: ['Pendiente de completar', 'ambar'],
  PENDIENTE_REVISION: ['Pendiente de revisión', 'ambar'],
  APROBADA_MANUALMENTE: ['Aprobada', 'verde'],
  RECHAZADA: ['Rechazada', 'rojo'],
  REQUIERE_CORRECCION: ['Requiere corrección', 'ambar'],
}

function etiquetaIdentidad(estado) {
  const [texto, color] = ESTADOS_IDENTIDAD[estado] ?? ['Sin solicitud', 'gris']
  return <span className={`badge ${color}`}>{texto}</span>
}

function CampoDetalle({ titulo, valor }) {
  return <div><dt>{titulo}</dt><dd>{valor || '—'}</dd></div>
}

export default function UsuariosAdmin() {
  const [filtros, setFiltros] = useState({ busqueda: '', rol: '', estado: 'todos' })
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async (filtrosActuales, paginaActual) => {
    setCargando(true)
    setError('')
    const parametros = new URLSearchParams({ pagina: String(paginaActual), porPagina: '20', estado: filtrosActuales.estado })
    if (filtrosActuales.rol) parametros.set('rol', filtrosActuales.rol)
    if (filtrosActuales.busqueda.trim()) parametros.set('busqueda', filtrosActuales.busqueda.trim())
    try {
      setResultado(await api.get(`/admin/usuarios?${parametros.toString()}`))
    } catch (e) {
      setError(e.message || 'No se pudo cargar la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const espera = window.setTimeout(() => cargar(filtros, pagina), 250)
    return () => window.clearTimeout(espera)
  }, [cargar, filtros, pagina])

  function cambiarFiltro(campo, valor) {
    setPagina(1)
    setFiltros((actual) => ({ ...actual, [campo]: valor }))
  }

  return (
    <section className="admin-pagina">
      <header className="admin-encabezado">
        <div><p className="auth-kicker">Administración</p><h2>Clientes y comisionistas</h2><p>Consulta de cuentas y perfiles. Las credenciales no están disponibles en esta sección.</p></div>
      </header>

      {error && <Alerta tipo="error" titulo="No se pudo cargar la lista">{error}</Alerta>}

      <div className="card admin-filtros">
        <label className="campo">
          <span>Buscar por nombre, apellido, correo o DNI</span>
          <input value={filtros.busqueda} onChange={(e) => cambiarFiltro('busqueda', e.target.value)} maxLength={120} placeholder="Escribe para buscar…" />
        </label>
        <label className="campo">
          <span>Tipo de usuario</span>
          <select value={filtros.rol} onChange={(e) => cambiarFiltro('rol', e.target.value)}>
            <option value="">Todos</option><option value="cliente">Clientes</option><option value="comisionista">Comisionistas</option>
          </select>
        </label>
        <label className="campo">
          <span>Estado de cuenta</span>
          <select value={filtros.estado} onChange={(e) => cambiarFiltro('estado', e.target.value)}>
            <option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
          </select>
        </label>
      </div>

      <section className="card admin-tabla-card">
        <div className="admin-tabla-resumen">
          <strong>{resultado?.total ?? 0} cuentas</strong>
          {cargando && <span className="campo-ayuda">Actualizando…</span>}
        </div>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Usuario</th><th>Tipo</th><th>Cuenta</th><th>Identidad</th><th>Registro</th><th>Perfil</th></tr></thead>
            <tbody>
              {resultado?.usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="admin-usuario-celda"><strong>{usuario.nombre} {usuario.apellido || ''}</strong><small>{usuario.email}</small></td>
                  <td>{usuario.rol === 'comisionista' ? 'Comisionista' : 'Cliente'}</td>
                  <td><span className={`badge punto ${usuario.activo ? 'verde' : 'rojo'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{usuario.rol === 'comisionista' ? etiquetaIdentidad(usuario.estado_verificacion) : 'No aplica'}</td>
                  <td>{formatoFecha(usuario.creado_en)}</td>
                  <td><button type="button" className="btn btn-chico" onClick={() => setSeleccionado(usuario)}>Consultar</button></td>
                </tr>
              ))}
              {!cargando && resultado?.usuarios.length === 0 && <tr><td className="admin-tabla-vacia" colSpan="6">No hay cuentas que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-paginacion">
          <span>{resultado ? `Página ${resultado.pagina} de ${Math.max(1, resultado.paginas)}` : 'Cargando resultados…'}</span>
          <div>
            <button type="button" className="btn btn-chico" disabled={!resultado || pagina <= 1 || cargando} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
            <button type="button" className="btn btn-chico" disabled={!resultado || pagina >= resultado.paginas || cargando} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
          </div>
        </div>
      </section>

      {seleccionado && (
        <Modal ancho="extra" onClose={() => setSeleccionado(null)}>
          <div className="historial-modal-cabecera"><h2>Perfil de usuario</h2><button type="button" className="btn" onClick={() => setSeleccionado(null)}>Cerrar</button></div>
          <p className="admin-perfil-tipo">{seleccionado.rol === 'comisionista' ? 'Comisionista' : 'Cliente'} · {seleccionado.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</p>
          <dl className="historial-detalle admin-perfil-detalle">
            <CampoDetalle titulo="Nombre" valor={`${seleccionado.nombre} ${seleccionado.apellido || ''}`} />
            <CampoDetalle titulo="Correo electrónico" valor={seleccionado.email} />
            <CampoDetalle titulo="DNI" valor={seleccionado.dni} />
            <CampoDetalle titulo="Teléfono" valor={seleccionado.telefono} />
            <CampoDetalle titulo="Correo verificado" valor={seleccionado.email_verificado ? 'Sí' : 'No'} />
            <CampoDetalle titulo="Fecha de registro" valor={formatoFecha(seleccionado.creado_en)} />
            {seleccionado.rol === 'comisionista' && <CampoDetalle titulo="Estado de identidad" valor={ESTADOS_IDENTIDAD[seleccionado.estado_verificacion]?.[0] ?? 'Sin solicitud'} />}
            {seleccionado.rol === 'comisionista' && <CampoDetalle titulo="Verificación iniciada" valor={seleccionado.verificacion_iniciada_en ? formatoFecha(seleccionado.verificacion_iniciada_en) : '—'} />}
            {seleccionado.rol === 'comisionista' && <CampoDetalle titulo="Presentación" valor={seleccionado.presentacion} />}
          </dl>
          <p className="admin-privacidad">Esta vista no consulta ni permite modificar contraseñas, tokens ni el rol de la cuenta.</p>
        </Modal>
      )}
    </section>
  )
}
