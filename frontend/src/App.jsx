import { useState } from 'react'
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
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
import Tarifa from './pages/Tarifa.jsx'
import SolicitarViaje from './pages/SolicitarViaje.jsx'
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
  if (ruta.startsWith('/mis-traslados/solicitar')) return 'Solicitar viaje'
  if (ruta.startsWith('/mis-traslados')) return 'Mis traslados'
  if (ruta.startsWith('/solicitudes')) return 'Solicitudes'
  if (ruta.endsWith('/editar')) return 'Modificar viaje'
  if (ruta.startsWith('/viajes/nuevo')) return 'Registrar viaje'
  if (ruta.startsWith('/viajes')) return 'Viajes'
  if (ruta.startsWith('/clientes')) return 'Clientes'
  if (ruta.startsWith('/gastos')) return 'Gastos'
  if (ruta.startsWith('/tarifa')) return 'Mi tarifa'
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

  if (ubicacion.pathname === '/verificar-email') return <VerificarEmail />

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

  // Clientes gestionan encomiendas y traslados; comisionistas revisan envíos y viajes.
  const esComisionista = usuario?.rol === 'comisionista' || usuario?.rol === 'administrador'
  const esCliente = usuario?.rol === 'cliente'
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
          {esComisionista && <NavLink to="/solicitudes" className={claseNav}><Icon nombre="checkcircle" /> Solicitudes</NavLink>}
          {esComisionista && <NavLink to="/clientes" className={claseNav}><Icon nombre="users" /> Clientes</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/tarifa" className={claseNav}><Icon nombre="tag" /> Mi tarifa</NavLink>}
          {usuario?.rol === 'comisionista' && <NavLink to="/gastos" className={claseNav}><Icon nombre="wallet" /> Gastos</NavLink>}
          {usuario?.rol === 'cliente' && <NavLink to="/mis-traslados" className={claseNav}><Icon nombre="logo" /> Mis traslados</NavLink>}
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
            {esComisionista && <Route path="/viajes/:id/editar" element={<ViajeEditar />} />}
            {esComisionista && <Route path="/solicitudes" element={<Postulaciones />} />}
            {esComisionista && <Route path="/clientes" element={<Clientes />} />}
            {usuario?.rol === 'comisionista' && <Route path="/tarifa" element={<Tarifa />} />}
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
    </div>
  )
}
