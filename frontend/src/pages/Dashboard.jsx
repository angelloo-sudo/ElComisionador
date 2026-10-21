// Resumen / Inicio: cada rol ve lo importante para su dia (ver controllers/resumen.controller.js).
import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta } from '../components/ui.jsx'
import ResumenComisionista from '../components/resumen/ResumenComisionista.jsx'
import ResumenCliente from '../components/resumen/ResumenCliente.jsx'

function nombreGuardado() {
  try { return JSON.parse(localStorage.getItem('comitrack_usuario') ?? 'null')?.nombre ?? '' } catch { return '' }
}

export default function Dashboard() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/resumen').then(setDatos).catch((e) => setError(e.message))
  }, [])

  if (error) return <Alerta tipo="error" titulo="No se pudo cargar el resumen">{error}</Alerta>
  if (!datos) return <p className="campo-ayuda">Cargando...</p>
  const nombre = nombreGuardado()
  return datos.rol === 'cliente' ? <ResumenCliente datos={datos} nombre={nombre} /> : <ResumenComisionista datos={datos} nombre={nombre} />
}
