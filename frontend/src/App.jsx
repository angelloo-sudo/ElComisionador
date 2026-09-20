import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Auth from './pages/Auth.jsx'
import { cerrarSesion } from './api/client.js'
import Dashboard from './pages/Dashboard.jsx'
import Viajes from './pages/Viajes.jsx'
import Encomiendas from './pages/Encomiendas.jsx'
import Clientes from './pages/Clientes.jsx'
import Perfil from './pages/Perfil.jsx'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('comitrack_token'))

  if (!token) {
    return <Auth onAuthenticated={() => setToken(localStorage.getItem('comitrack_token'))} />
  }

  function handleLogout() {
    cerrarSesion()
    setToken(null)
  }

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">ComiTrack</span>
        <Link to="/">Inicio</Link>
        <Link to="/viajes">Viajes</Link>
        <Link to="/encomiendas">Encomiendas</Link>
        <Link to="/clientes">Clientes</Link>
<<<<<<< HEAD
        <Link to="/perfil">Mi perfil</Link>
=======
        <button type="button" onClick={handleLogout}>Cerrar sesión</button>
>>>>>>> 3f84e1c18fb6a0f0f734b7e1874623ee4276024b
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/viajes" element={<Viajes />} />
          <Route path="/encomiendas" element={<Encomiendas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/perfil" element={<Perfil />} />
        </Routes>
      </main>
    </div>
  )
}
