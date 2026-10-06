import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'

export default function Dashboard() {
  const [estado, setEstado] = useState('conectando...')

  useEffect(() => {
    api.get('/health')
      .then((data) => setEstado(data.status))
      .catch(() => setEstado('sin conexion con la API'))
  }, [])

  return (
    <section className="card">
      <div className="card-cabecera">
        <div>
          <h2>Panel de ComiTrack</h2>
          <p>Desde acá vas a gestionar viajes, encomiendas, pasajeros, clientes y finanzas.</p>
        </div>
        <span className={`badge punto ${estado === 'ok' ? 'verde' : 'gris'}`}>API: {estado}</span>
      </div>
      <div className="card-cuerpo">
        <p className="campo-ayuda"><Icon nombre="logo" tamano={16} /> Elegí una sección en el menú de la izquierda para empezar.</p>
      </div>
    </section>
  )
}
