import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function Dashboard() {
  const [estado, setEstado] = useState('conectando...')

  useEffect(() => {
    api.get('/health')
      .then((data) => setEstado(data.status))
      .catch(() => setEstado('sin conexion con la API'))
  }, [])

  return (
    <section>
      <h1>Panel de ComiTrack</h1>
      <p>Estado de la API: <strong>{estado}</strong></p>
      <p>Desde aca vas a gestionar viajes, encomiendas, pasajeros, clientes y finanzas.</p>
    </section>
  )
}
