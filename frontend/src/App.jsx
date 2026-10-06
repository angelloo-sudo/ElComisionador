import { useState } from 'react'
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Auth from './pages/Auth.jsx'
import { cerrarSesion } from './api/client.js'
import Dashboard from './pages/Dashboard.jsx'
import Viajes from './pages/Viajes.jsx'
import ViajeNuevo from './pages/ViajeNuevo.jsx'
import Encomiendas from './pages/Encomiendas.jsx'
import Perfil from './pages/Perfil.jsx'
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

function tituloDePagina(ruta, esComisionista) {
  if (ruta.startsWith('/viajes/nuevo')) return 'Registrar viaje'
  if (ruta.startsWith('/viajes')) return 'Viajes'
  if (ruta.startsWith('/encomiendas')) return 'Encomiendas'
  if (ruta.startsWith('/perfil')) return 'Mi perfil'
  return esComisionista ? 'Resumen' : 'Inicio'
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
  const ubicacion = useLocation()
  const navegar = useNavigate()

  if (!token) {
    if (pantallaFinal) return <PantallaFinal tipo={pantallaFinal} onVolver={() => setPantallaFinal(null)} />
    return (
      <Auth
        onAuthenticated={() => {
          setToken(localStorage.getItem('comitrack_token'))
          setUsuario(usuarioGuardado())
        }}
      />
    )
  }

  function salir(tipo) {
    cerrarSesion()
    setToken(null)
    setUsuario(null)
    setConfirmandoSalida(false)
    setPantallaFinal(tipo)
    navegar('/')
  }

  // Las pantallas de Viajes y Encomiendas son
  // exclusivas del comisionista; el cliente solo ve su propia cuenta (Mi perfil).
  const esComisionista = usuario?.rol === 'comisionista' || usuario?.rol === 'administrador'
  const nombreCompleto = `${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`.trim()
  const claseNav = ({ isActive }) => `nav-item${isActive ? ' activo' : ''}`

  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        <p className="nav-titulo">Menú principal</p>
        <nav className="nav-lista">
          <NavLink to="/" end className={claseNav}><Icon nombre="grid" /> {esComisionista ? 'Resumen' : 'Inicio'}</NavLink>
          {esComisionista && <NavLink to="/viajes" className={claseNav}><Icon nombre="logo" /> Viajes</NavLink>}
          {esComisionista && <NavLink to="/encomiendas" className={claseNav}><Icon nombre="package" /> Encomiendas</NavLink>}
        </nav>
        <div className="sidebar-fondo">
          <p className="nav-titulo">Cuenta</p>
          <nav className="nav-lista">
            <NavLink to="/perfil" className={claseNav}><Icon nombre="user" /> Mi perfil</NavLink>
            <button type="button" className="nav-item peligro" onClick={() => setConfirmandoSalida(true)}>
              <Icon nombre="logout" /> Cerrar sesión
            </button>
          </nav>
        </div>
      </aside>

      <div className="principal">
        <header className="topbar">
          <div>
            <p className="topbar-fecha">{fechaDeHoy()}</p>
            <h1>{tituloDePagina(ubicacion.pathname, esComisionista)}</h1>
          </div>
          <div className="topbar-usuario">
            <div>
              <strong>{nombreCompleto || usuario?.email}</strong>
              <span>{esComisionista ? 'Comisionista' : 'Cliente'}</span>
            </div>
            <Avatar nombre={usuario?.nombre ?? ''} apellido={usuario?.apellido ?? ''} tamano={40} />
          </div>
        </header>

        <main className="contenido">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {esComisionista && <Route path="/viajes" element={<Viajes />} />}
            {esComisionista && <Route path="/viajes/nuevo" element={<ViajeNuevo />} />}
            {esComisionista && <Route path="/encomiendas" element={<Encomiendas />} />}
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
    </div>
  )
}
