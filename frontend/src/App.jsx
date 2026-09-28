import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Auth from './pages/Auth.jsx'
import { cerrarSesion } from './api/client.js'
import Dashboard from './pages/Dashboard.jsx'
import Viajes from './pages/Viajes.jsx'
import Encomiendas from './pages/Encomiendas.jsx'
import Perfil from './pages/Perfil.jsx'

function usuarioGuardado() {
  try {
    return JSON.parse(localStorage.getItem('comitrack_usuario') ?? 'null')
  } catch {
    return null
  }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('comitrack_token'))
  const [usuario, setUsuario] = useState(usuarioGuardado)

  if (!token) {
    return (
      <Auth
        onAuthenticated={() => {
          setToken(localStorage.getItem('comitrack_token'))
          setUsuario(usuarioGuardado())
        }}
      />
    )
  }

  function handleLogout() {
    cerrarSesion()
    setToken(null)
    setUsuario(null)
  }

  // Las pantallas de Viajes y Encomiendas son
  // exclusivas del comisionista; el cliente solo ve su propia cuenta (Mi perfil).
  const esComisionista = usuario?.rol === 'comisionista' || usuario?.rol === 'administrador'

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">ComiTrack</span>
        <Link to="/">Inicio</Link>
        {esComisionista && <Link to="/viajes">Viajes</Link>}
        {esComisionista && <Link to="/encomiendas">Encomiendas</Link>}
        <Link to="/perfil">Mi perfil</Link>
        <button type="button" onClick={handleLogout}>Cerrar sesión</button>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {esComisionista && <Route path="/viajes" element={<Viajes />} />}
          {esComisionista && <Route path="/encomiendas" element={<Encomiendas />} />}
          <Route path="/perfil" element={<Perfil onCuentaDadaDeBaja={handleLogout} />} />
        </Routes>
      </main>
    </div>
  )
}
