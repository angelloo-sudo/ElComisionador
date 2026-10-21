// Mi tarifa (comisionista): configura su precio por km en pesos argentinos. El sistema lo usa para
// calcular lo que paga el cliente que se postula a uno de sus viajes: precio por km x km (x pasajeros).
import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo, Toast } from '../components/ui.jsx'
import { formatoPesos } from '../utils/tarifa.js'

// "350,5" / "350.5" / "1.250,50" -> 350.5 (null si no es un numero valido)
function aNumero(texto) {
  const limpio = String(texto).trim().replace(/\s/g, '')
  if (!limpio) return null
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return NaN
  return Number(normal)
}

export default function Tarifa() {
  const [guardado, setGuardado] = useState(undefined) // undefined = cargando, null = sin tarifa
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    api.get('/tarifa')
      .then((t) => { setGuardado(t.precio_km); setTexto(t.precio_km ? String(t.precio_km).replace('.', ',') : '') })
      .catch((e) => { setErrorCarga(e.message); setGuardado(null) })
  }, [])

  const numero = aNumero(texto)
  const sinCambios = (numero ?? null) === (guardado ?? null)

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    if (numero === null) return setError('Ingresá el precio por km (por ejemplo 350 o 350,50).')
    if (Number.isNaN(numero) || numero <= 0) return setError('El precio por km debe ser un número mayor a 0, con hasta 2 decimales.')
    if (numero > 1000000) return setError('Ese precio por km es demasiado alto.')
    setGuardando(true)
    try {
      const r = await api.put('/tarifa', { precio_km: numero })
      setGuardado(r.precio_km)
      setTexto(String(r.precio_km).replace('.', ','))
      setToast({ titulo: 'Tarifa guardada', texto: `Tu precio por km ahora es ${formatoPesos(r.precio_km)}. Se aplica a las nuevas postulaciones.` })
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      {errorCarga && <Alerta tipo="error" titulo="No se pudo cargar tu tarifa">{errorCarga}</Alerta>}
      {guardado === null && !errorCarga && (
        <Alerta tipo="aviso" titulo="Todavía no configuraste tu precio por km">
          Mientras no lo configures, los clientes que se postulen a tus viajes van a ver el monto como “A convenir”.
        </Alerta>
      )}

      <div className="tarifa-grilla" style={{ gridTemplateColumns: 'minmax(0, 760px)' }}>
        <form className="card" onSubmit={guardar} noValidate>
          <div className="card-cabecera">
            <div>
              <h2>Precio por kilómetro</h2>
              <p>Cuando un cliente se postula a uno de tus viajes, el sistema multiplica este precio por los kilómetros del recorrido.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            <div className="tarifa-entrada">
              <Campo label="Precio por km (pesos ARS)" requerido icono="tag" error={error} ayuda="Ejemplo: 350 o 350,50">
                <input inputMode="decimal" value={texto} onChange={(e) => { setTexto(e.target.value); setError(null) }} placeholder="Ej: 350" maxLength={12} aria-label="Precio por kilómetro en pesos" />
              </Campo>
            </div>
            <p className="nota-resumen" style={{ marginTop: 18 }}>
              Fórmula: <strong>precio por km × kilómetros</strong>. Si el cliente viaja con acompañantes se multiplica además por la cantidad de pasajeros; una encomienda se cobra una sola vez.
              Los kilómetros son los de la ruta en auto entre el origen y el destino de tu viaje.
            </p>
            <p className="nota-resumen">Si cambiás tu tarifa, las solicitudes que ya recibiste conservan el precio con el que se enviaron.</p>
          </div>
          <div className="card-pie">
            <button type="submit" className="btn btn-primario" disabled={guardando || guardado === undefined || sinCambios}>
              <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : 'Guardar tarifa'}
            </button>
          </div>
        </form>

      </div>

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={() => setToast(null)} />}
    </section>
  )
}
