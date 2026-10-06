// Carga la lista de localidades de Cordoba una sola vez y la comparte entre componentes.
import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

let promesaCache = null

function cargar() {
  if (!promesaCache) {
    promesaCache = api.get('/localidades').catch((err) => {
      promesaCache = null // permite reintentar si fallo
      throw err
    })
  }
  return promesaCache
}

export default function useLocalidades() {
  const [localidades, setLocalidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    cargar()
      .then((lista) => activo && setLocalidades(lista))
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false))
    return () => { activo = false }
  }, [])

  return { localidades, cargando, error }
}
