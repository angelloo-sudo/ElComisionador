import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Viajes from './pages/Viajes.jsx'
import Encomiendas from './pages/Encomiendas.jsx'
import Clientes from './pages/Clientes.jsx'

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">ComiTrack</span>
        <Link to="/">Inicio</Link>
        <Link to="/viajes">Viajes</Link>
        <Link to="/encomiendas">Encomiendas</Link>
        <Link to="/clientes">Clientes</Link>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/viajes" element={<Viajes />} />
          <Route path="/encomiendas" element={<Encomiendas />} />
          <Route path="/clientes" element={<Clientes />} />
        </Routes>
      </main>
    </div>
  )
}
