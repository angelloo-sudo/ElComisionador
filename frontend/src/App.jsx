import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Auth from './pages/Auth.jsx'
import VerificarEmail from './pages/VerificarEmail.jsx'
import { api, cerrarSesion, leerContinuacionVerificacion } from './api/client.js'
import Dashboard from './pages/Dashboard.jsx'
import Viajes from './pages/Viajes.jsx'
import ViajeNuevo from './pages/ViajeNuevo.jsx'
import ViajeEditar from './pages/ViajeEditar.jsx'
import Clientes from './pages/Clientes.jsx'
import Perfil from './pages/Perfil.jsx'
import MisTraslados from './pages/MisTraslados.jsx'
import Postulaciones from './pages/Postulaciones.jsx'
import Gastos from './pages/Gastos.jsx'
import Ingresos from './pages/Ingresos.jsx'
import ReporteRentabilidad from './pages/ReporteRentabilidad.jsx'
import ReportesRentabilidad from './pages/ReportesRentabilidad.jsx'
import ReporteRentabilidadDetalle from './pages/ReporteRentabilidadDetalle.jsx'
import Tarifa from './pages/Tarifa.jsx'
import SolicitarViaje from './pages/SolicitarViaje.jsx'
import Landing from './pages/Landing.jsx'
import Notificaciones from './pages/Notificaciones.jsx'
import VerificacionIdentidad from './pages/VerificacionIdentidad.jsx'
import VerificacionesAdmin from './pages/VerificacionesAdmin.jsx'
import Historiales from './pages/Historiales.jsx'
import Bienvenida from './components/Bienvenida.jsx'
import Icon from './components/Icon.jsx'
import Avatar from './components/Avatar.jsx'
import { Logo, Modal } from './components/ui.jsx'

function usuarioGuardado() {
  try {
    return JSON.parse(localStorage.getItem('comitrack_usuario') ?? 'null')
  } catch {
    return null
  }
}

function fechaDeHoy() {
  const texto = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function tituloDePagina(ruta, rol) {
  if (ruta.startsWith('/historial/viajes')) return 'Historial de viajes'
  if (ruta.startsWith('/historial/clientes')) return 'Operaciones de clientes'
  if (ruta.startsWith('/historial/encomiendas')) return 'Historial de encomiendas'
  if (ruta.startsWith('/historial/pasajeros')) return 'Historial de pasajeros'
  if (ruta.startsWith('/mis-traslados/solicitar')) return 'Solicitar viaje'
  if (ruta.startsWith('/mis-traslados')) return 'Viajes'
  if (ruta.startsWith('/notificaciones')) return 'Notificaciones'
  if (ruta.startsWith('/verificacion')) return 'Verificación de identidad'
  if (ruta.startsWith('/admin/verificaciones')) return 'Revisión de identidad'
  if (ruta.startsWith('/solicitudes')) return 'Solicitudes'
  if (ruta.endsWith('/editar')) return 'Modificar viaje'
  if (ruta.startsWith('/viajes/nuevo')) return 'Registrar viaje'
  if (ruta.startsWith('/viajes')) return 'Viajes'
  if (ruta.startsWith('/clientes')) return 'Clientes'
  if (ruta.startsWith('/ingresos')) return 'Ingresos'
  if (ruta.startsWith('/graficos-rentabilidad')) return 'Gráficos de rentabilidad'
  if (ruta.startsWith('/rentabilidad')) return 'Rentabilidad'
  if (ruta.startsWith('/reportes-rentabilidad')) return 'Reportes de rentabilidad'
  if (ruta.startsWith('/gastos')) return 'Gastos'
  if (ruta.startsWith('/tarifa')) return 'Mi tarifa'
  if (ruta.startsWith('/perfil')) return 'Mi perfil'
  return rol === 'administrador' ? 'Resumen' : 'Inicio'
}

// Pantalla final tras cerrar sesion o dar de baja la cuenta.
function PantallaFinal({ tipo, onVolver }) {
  const baja = tipo === 'baja'
  return (
    <main className="auth-pagina">
      <div className="auth-card auth-centro">
        <span className={`icono-caja ${baja ? 'rojo' : 'gris'}`}><Icon nombre={baja ? 'userx' : 'logout'} tamano={26} /></span>
        <p className="auth-kicker">ComiTrack</p>
        <h1>{baja ? 'Usuario dado de baja' : 'Sesión cerrada'}</h1>
        <p>
          {baja
            ? 'Tu usuario fue dado de baja correctamente. Ya no podrás iniciar sesión con esta cuenta.'
            : 'Cerraste sesión correctamente. Vuelve a iniciar sesión cuando quieras continuar.'}
        </p>
        <button type="button" className="btn btn-primario btn-bloque" onClick={onVolver}>
          {baja ? 'Volver al inicio' : 'Volver a iniciar sesión'} <Icon nombre="arrow" />
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('comitrack_token'))
  const [usuario, setUsuario] = useState(usuarioGuardado)
  const [pantallaFinal, setPantallaFinal] = useState(null) // null | 'cerrada' | 'baja'
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const [mostrarBienvenida, setMostrarBienvenida] = useState(false)
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0)
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const cerrarBienvenida = useCallback(() => setMostrarBienvenida(false), [])

  if (ubicacion.pathname === '/verificar-email') return <VerificarEmail />

  if (!token) {
    if (leerContinuacionVerificacion()) return <VerificarEmail />
    if (pantallaFinal) return <PantallaFinal tipo={pantallaFinal} onVolver={() => setPantallaFinal(null)} />
    const abrirAcceso = () => navegar('/ingresar')
    if (ubicacion.pathname !== '/ingresar' && !new URLSearchParams(ubicacion.search).has('token')) {
      return <Landing onIngresar={abrirAcceso} />
    }
    return (
      <Auth
        onAuthenticated={() => {
          setToken(localStorage.getItem('comitrack_token'))
          setUsuario(usuarioGuardado())
          setMostrarBienvenida(true)
          navegar('/')
        }}
      />
    )
  }

  if (ubicacion.pathname === '/ingresar') return <Navigate to="/" replace />

  function salir(tipo) {
    cerrarSesion()
    setToken(null)
    setUsuario(null)
    setConfirmandoSalida(false)
    // El cierre de sesión debe volver directamente al formulario de acceso.
    // La pantalla final se conserva para confirmar una baja de cuenta.
    setPantallaFinal(tipo === 'baja' ? 'baja' : null)
    navegar('/')
  }

  // Clientes gestionan encomiendas y traslados; comisionistas revisan envíos y viajes.
  const esComisionista = usuario?.rol === 'comisionista' || usuario?.rol === 'administrador'
  const esCliente = usuario?.rol === 'cliente'
  const nombreCompleto = `${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`.trim()
  const claseNav = ({ isActive }) => `nav-item${isActive ? ' activo' : ''}`

  useEffect(() => {
    if (!esCliente) {
      setNotificacionesNoLeidas(0)
      return undefined
    }
    let vigente = true
    const actualizar = () => api.get('/notificaciones/no-leidas')
      .then(({ cantidad }) => { if (vigente) setNotificacionesNoLeidas(cantidad) })
      .catch((error) => console.error('No se pudo actualizar el contador de notificaciones:', error))
    actualizar()
    const intervalo = window.setInterval(actualizar, 30_000)
    window.addEventListener('notificaciones:actualizadas', actualizar)
    return () => {
      vigente = false
      window.clearInterval(intervalo)
      window.removeEventListener('notificaciones:actualizadas', actualizar)
    }
  }, [esCliente])

  return (
    <div className="app">
      <header className="sidebar barra-aplicacion">
        <div className="barra-superior">
          <div className="barra-identidad">
            <Logo />
            <div className="barra-titulo">
              <p className="topbar-fecha">{fechaDeHoy()}</p>
              <h1>{tituloDePagina(ubicacion.pathname, usuario?.rol)}</h1>
            </div>
          </div>
          <div className="barra-cuenta">
            <div className="topbar-usuario">
              <div>
                <strong>{nombreCompleto || usuario?.email}</strong>
                <span>{usuario?.rol === 'administrador' ? 'Administrador' : esComisionista ? 'Comisionista' : 'Cliente'}</span>
              </div>
              <Avatar nombre={usuario?.nombre ?? ''} apellido={usuario?.apellido ?? ''} tamano={40} />
            </div>
            <NavLink to="/perfil" className={claseNav} aria-label="Mi perfil" title="Mi perfil"><Icon nombre="user" /></NavLink>
            <button type="button" className="nav-item peligro" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => setConfirmandoSalida(true)}>
              <Icon nombre="logout" />
            </button>
          </div>
        </div>
        <nav className="nav-lista barra-navegacion" aria-label="Navegación principal">
          <NavLink to="/" end className={claseNav}><Icon nombre="grid" /> {usuario?.rol === 'administrador' ? 'Resumen' : 'Inicio'}</NavLink>
          {esComisionista && <NavLink to="/viajes" className={claseNav}><Icon nombre="logo" /> Viajes</NavLink>}
          {esComisionista && <NavLink to="/solicitudes" className={claseNav}><Icon nombre="checkcircle" /> Solicitudes</NavLink>}
          {esComisionista && <NavLink to="/clientes" className={claseNav}><Icon nombre="users" /> Clientes</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/historial/viajes" className={claseNav}>Historial</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/historial/clientes" className={claseNav}>Operaciones clientes</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/tarifa" className={claseNav}><Icon nombre="tag" /> Tarifa</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/ingresos" className={claseNav}><Icon nombre="wallet" /> Ingresos</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/gastos" className={claseNav}><Icon nombre="wallet" /> Gastos</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/rentabilidad" className={claseNav}><Icon nombre="wallet" /> Rentabilidad</NavLink>}
          {usuario?.rol === 'cliente' && <NavLink to="/mis-traslados" className={claseNav}><Icon nombre="logo" /> Viajes</NavLink>}
          {usuario?.rol === 'cliente' && <NavLink to="/notificaciones" className={claseNav} aria-label={`Notificaciones${notificacionesNoLeidas ? `, ${notificacionesNoLeidas} sin leer` : ''}`}><Icon nombre="bell" /> Notificaciones{notificacionesNoLeidas > 0 && <span className="notificacion-contador">{notificacionesNoLeidas}</span>}</NavLink>}
          {(esCliente || usuario?.rol === 'comisionista') && <NavLink to="/verificacion" className={claseNav}><Icon nombre="idcard" /> Verificación</NavLink>}
          {usuario?.rol === 'administrador' && <NavLink to="/admin/verificaciones" className={claseNav}><Icon nombre="idcard" /> Verificaciones</NavLink>}
        </nav>
      </header>

      <div className="principal">
        <main className="contenido">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {esComisionista && <Route path="/viajes" element={<Viajes />} />}
            {esComisionista && <Route path="/viajes/nuevo" element={<ViajeNuevo />} />}
            {esComisionista && <Route path="/viajes/:id/editar" element={<ViajeEditar />} />}
            {esComisionista && <Route path="/solicitudes" element={<Postulaciones />} />}
            {esComisionista && <Route path="/clientes" element={<Clientes />} />}
            {usuario?.rol === 'comisionista' && <Route path="/historial/:seccion" element={<Historiales />} />}
            {usuario?.rol === 'comisionista' && <Route path="/tarifa" element={<Tarifa />} />}
            {usuario?.rol === 'comisionista' && <Route path="/ingresos" element={<Ingresos />} />}
            {usuario?.rol === 'comisionista' && <Route path="/gastos" element={<Gastos />} />}
            {usuario?.rol === 'comisionista' && <Route path="/rentabilidad" element={<ReporteRentabilidad />} />}
            {usuario?.rol === 'comisionista' && <Route path="/reportes-rentabilidad" element={<ReportesRentabilidad />} />}
            {usuario?.rol === 'comisionista' && <Route path="/reportes-rentabilidad/:id" element={<ReporteRentabilidadDetalle />} />}
            {usuario?.rol === 'cliente' && <Route path="/mis-traslados" element={<MisTraslados />} />}
            {usuario?.rol === 'cliente' && <Route path="/notificaciones" element={<Notificaciones />} />}
            {usuario?.rol === 'cliente' && <Route path="/mis-traslados/solicitar/:id" element={<SolicitarViaje />} />}
            {(esCliente || usuario?.rol === 'comisionista') && <Route path="/verificacion" element={<VerificacionIdentidad />} />}
            {usuario?.rol === 'administrador' && <Route path="/admin/verificaciones" element={<VerificacionesAdmin />} />}
            <Route path="/perfil" element={<Perfil onCuentaDadaDeBaja={() => salir('baja')} />} />
          </Routes>
        </main>
      </div>

      {confirmandoSalida && (
        <Modal onClose={() => setConfirmandoSalida(false)}>
          <span className="modal-icono"><Icon nombre="logout" tamano={22} /></span>
          <h2>¿Cerrar sesión?</h2>
          <p>Vas a salir de tu cuenta. Podrás volver a iniciar sesión cuando quieras.</p>
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={() => setConfirmandoSalida(false)}>Cancelar</button>
            <button type="button" className="btn btn-primario" onClick={() => salir('cerrada')}>Cerrar sesión</button>
          </div>
        </Modal>
      )}
      {mostrarBienvenida && <Bienvenida nombre={usuario?.nombre} onCerrar={cerrarBienvenida} />}
    </div>
  )
}
