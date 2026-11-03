import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Auth from './pages/Auth.jsx'
import VerificarEmail from './pages/VerificarEmail.jsx'
import { cerrarSesion } from './api/client.js'
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
import Tarifa from './pages/Tarifa.jsx'
import SolicitarViaje from './pages/SolicitarViaje.jsx'
import Landing from './pages/Landing.jsx'
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

function Bienvenida({ nombre, onCerrar }) {
  useEffect(() => {
    const temporizador = window.setTimeout(onCerrar, 3000)
    return () => window.clearTimeout(temporizador)
  }, [onCerrar])

  return (
    <div className="bienvenida-overlay" role="status" aria-live="polite">
      <div className="bienvenida-contenido">
        <div className="bienvenida-mascota-wrap">
          <svg className="bienvenida-canguro" viewBox="0 0 240 300" role="img" aria-label="Canguro de ComiTrack saludando">
            <g className="bienvenida-cola">
              <path d="M91 183C63 193 54 214 30 224c-12 5-22 4-27 1 14 21 42 26 69 9l41-25" fill="#e89a3c" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
              <path d="M8 225c14 12 28 12 44 5" fill="none" stroke="#f5bd69" strokeWidth="5" strokeLinecap="round" />
            </g>
            <path d="M87 184c-15 9-19 31-17 55l-5 38c-1 10 6 16 14 14l19-5 18-61 9 59c2 7 9 10 16 8l16-5c8-2 10-10 6-17l-13-34 3-48-23-21z" fill="#e99437" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
            <path d="m78 267 24 2 13 15H76c-8 0-10-10-4-15m72 2 20-5 15 13c4 4 1 10-5 10h-35z" fill="#f0a84f" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
            <path d="M91 117c-13 11-18 34-15 58 3 23 12 43 22 52 14 14 51 17 69 3 12-9 19-31 17-55-2-26-10-47-23-58z" fill="#e99437" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
            <path d="M98 151c-8 20-6 52 4 66 8 11 36 16 50 7 12-8 17-33 12-55-9 9-19 13-32 13-13 0-25-11-34-31z" fill="#ffd294" stroke="#26364b" strokeWidth="3" strokeLinejoin="round" />
            <path d="M100 117c-8-14-14-38-11-61 2-15 11-31 20-31 13 0 17 27 17 49l-2 25m20 18c10-15 22-39 23-62 1-16-6-31-15-32-13-1-22 24-27 45l-4 25" fill="#e99437" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
            <path d="M103 80c-2-20 0-36 6-37 5 0 8 16 8 33m16 0c5-20 12-35 17-33 5 2 1 19-6 37" fill="#f5bc75" stroke="#26364b" strokeWidth="3" strokeLinejoin="round" />
            <path d="M89 93c7-18 22-29 40-29 20 0 36 12 41 31 4 16-2 35-13 46-8 9-18 13-29 13-12 0-24-5-32-15-10-12-14-31-7-46z" fill="#f3a84f" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
            <path d="M101 109c5 22 16 34 29 34 14 0 24-12 29-34-8 5-18 8-29 8-10 0-21-3-29-8z" fill="#ffd294" />
            <ellipse cx="111" cy="99" rx="3.7" ry="5" fill="#26364b" /><ellipse cx="148" cy="99" rx="3.7" ry="5" fill="#26364b" />
            <path d="M119 112c5-5 13-5 18 0-2 7-5 10-9 10s-7-3-9-10zm-4 15c6 6 14 7 21 0" fill="#fff2da" stroke="#26364b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M97 144c5 14 12 28 21 34l-2 12c-2 5-8 5-11 1l-16-27m86-20c-1 10-2 19-7 27" fill="#f3a84f" stroke="#26364b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <g className="bienvenida-brazo-saludo">
              <path d="M163 151c12-4 19-18 23-31l-8-15c-3-6 1-11 6-9l9 9 4-20c1-5 7-6 9-1l2 14 6-15c2-5 8-3 8 2l-1 17 6-9c3-4 8-1 6 4l-8 24c-5 16-15 32-30 39l-22 5z" fill="#f3a84f" stroke="#26364b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m186 108 4 6m11-17 1 9m13-7-2 9m9 1-4 7" fill="none" stroke="#ffd294" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="bienvenida-caja">
              <path d="m158 205 52-14 25 11v47l-53 17-24-13z" fill="#d49a54" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
              <path d="m158 205 25 12 52-15m-52 15v49m17-54 1 12 17-5v-13m-38-2 20 10 19-5" fill="none" stroke="#26364b" strokeWidth="4" strokeLinejoin="round" />
              <path d="m192 217 17-5v11l-17 5z" fill="#f1c17b" stroke="#26364b" strokeWidth="2" />
            </g>
            <ellipse cx="122" cy="286" rx="100" ry="7" fill="#26364b" opacity=".16" />
          </svg>
        </div>
        <span className="bienvenida-etiqueta">COMITRACK</span>
        <h2>¡Bienvenido{nombre ? `, ${nombre}` : ''}!</h2>
        <p>Nos alegra tenerte acá</p>
      </div>
    </div>
  )
}

function tituloDePagina(ruta, rol) {
  if (ruta.startsWith('/mis-traslados/solicitar')) return 'Solicitar viaje'
  if (ruta.startsWith('/mis-traslados')) return 'Mis traslados'
  if (ruta.startsWith('/solicitudes')) return 'Solicitudes'
  if (ruta.endsWith('/editar')) return 'Modificar viaje'
  if (ruta.startsWith('/viajes/nuevo')) return 'Registrar viaje'
  if (ruta.startsWith('/viajes')) return 'Viajes'
  if (ruta.startsWith('/clientes')) return 'Clientes'
  if (ruta.startsWith('/ingresos')) return 'Ingresos'
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
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const cerrarBienvenida = useCallback(() => setMostrarBienvenida(false), [])

  if (ubicacion.pathname === '/verificar-email') return <VerificarEmail />

  if (!token) {
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
                <span>{esComisionista ? 'Comisionista' : 'Cliente'}</span>
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
          {usuario?.rol === 'comisionista' && <NavLink to="/tarifa" className={claseNav}><Icon nombre="tag" /> Mi tarifa</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/ingresos" className={claseNav}><Icon nombre="wallet" /> Ingresos</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/gastos" className={claseNav}><Icon nombre="wallet" /> Gastos</NavLink>}
          {usuario?.rol === 'cliente' && <NavLink to="/mis-traslados" className={claseNav}><Icon nombre="logo" /> Mis traslados</NavLink>}
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
            {usuario?.rol === 'comisionista' && <Route path="/tarifa" element={<Tarifa />} />}
            {usuario?.rol === 'comisionista' && <Route path="/ingresos" element={<Ingresos />} />}
            {usuario?.rol === 'comisionista' && <Route path="/gastos" element={<Gastos />} />}
            {usuario?.rol === 'cliente' && <Route path="/mis-traslados" element={<MisTraslados />} />}
            {usuario?.rol === 'cliente' && <Route path="/mis-traslados/solicitar/:id" element={<SolicitarViaje />} />}
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
