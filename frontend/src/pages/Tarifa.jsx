// Mi tarifa (comisionista): configura su precio por km en pesos argentinos. El sistema lo usa para
// calcular lo que paga el cliente que se postula a uno de sus viajes: precio por km x km (x pasajeros).
import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, Campo, Toast } from '../components/ui.jsx'
import { formatoPesos } from '../utils/tarifa.js'

const TAMANOS_ENCOMIENDA = [
  { clave: 'chica', etiqueta: 'Chica' },
  { clave: 'mediana', etiqueta: 'Mediana' },
  { clave: 'grande', etiqueta: 'Grande' },
]
const MINIMOS_VACIOS = { chica: '', mediana: '', grande: '' }
const MAXIMO_MONTO_MINIMO = 9_999_999_999.99

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
  const [minimosGuardados, setMinimosGuardados] = useState(null)
  const [minimosTexto, setMinimosTexto] = useState(MINIMOS_VACIOS)
  const [error, setError] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    api.get('/tarifa')
      .then((t) => {
        const minimos = Object.fromEntries(TAMANOS_ENCOMIENDA.map(({ clave }) => [clave, t.minimos_encomienda?.[clave] ?? null]))
        setGuardado(t.precio_km)
        setTexto(t.precio_km != null ? String(t.precio_km).replace('.', ',') : '')
        setMinimosGuardados(minimos)
        setMinimosTexto(Object.fromEntries(TAMANOS_ENCOMIENDA.map(({ clave }) => [
          clave, minimos[clave] != null ? String(minimos[clave]).replace('.', ',') : '',
        ])))
      })
      .catch((e) => {
        setErrorCarga(e.message)
        setGuardado(null)
        setMinimosGuardados({ chica: null, mediana: null, grande: null })
      })
  }, [])

  const numero = aNumero(texto)
  const minimosActuales = Object.fromEntries(TAMANOS_ENCOMIENDA.map(({ clave }) => [clave, aNumero(minimosTexto[clave])]))
  const minimosSinCambios = minimosGuardados !== null && TAMANOS_ENCOMIENDA.every(({ clave }) => (
    (minimosActuales[clave] ?? null) === minimosGuardados[clave]
  ))
  const sinCambios = (numero ?? null) === (guardado ?? null) && minimosSinCambios

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    if (numero === null && guardado !== null) return setError('Ingresá el precio por km (por ejemplo 350 o 350,50).')
    if (numero !== null && (Number.isNaN(numero) || numero <= 0)) return setError('El precio por km debe ser un número mayor a 0, con hasta 2 decimales.')
    if (numero > 1000000) return setError('Ese precio por km es demasiado alto.')

    const minimos = {}
    for (const { clave, etiqueta } of TAMANOS_ENCOMIENDA) {
      const monto = minimosActuales[clave]
      if (Number.isNaN(monto) || (monto !== null && (monto < 0 || monto > MAXIMO_MONTO_MINIMO))) {
        return setError(`El monto mínimo para encomienda ${etiqueta.toLowerCase()} debe ser un número entre 0 y ${MAXIMO_MONTO_MINIMO}.`)
      }
      minimos[clave] = monto
    }

    setGuardando(true)
    try {
      const r = await api.put('/tarifa', { precio_km: numero ?? guardado, minimos_encomienda: minimos })
      setGuardado(r.precio_km)
      setTexto(r.precio_km != null ? String(r.precio_km).replace('.', ',') : '')
      setMinimosGuardados(r.minimos_encomienda)
      setMinimosTexto(Object.fromEntries(TAMANOS_ENCOMIENDA.map(({ clave }) => [
        clave, r.minimos_encomienda[clave] != null ? String(r.minimos_encomienda[clave]).replace('.', ',') : '',
      ])))
      const mensajePrecio = r.precio_km != null
        ? `Tu precio por km ahora es ${formatoPesos(r.precio_km)}.`
        : 'No configuraste un precio por km.'
      setToast({ titulo: 'Tarifa guardada', texto: `${mensajePrecio} Se guardaron los montos mínimos por tamaño de encomienda.` })
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
          Podés configurar los mínimos por tamaño aunque todavía no hayas definido el precio por km.
        </Alerta>
      )}

      <div className="tarifa-grilla" style={{ gridTemplateColumns: 'minmax(0, 760px)' }}>
        <form className="card" onSubmit={guardar} noValidate>
          <div className="card-cabecera">
            <div>
              <h2>Tarifa y mínimos de encomienda</h2>
              <p>Para pasajeros se multiplica este precio por los kilómetros del tramo. Para encomiendas se suma el mínimo del tamaño al costo por kilómetro.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            <div className="tarifa-entrada">
              <Campo label="Precio por km (pesos ARS)" icono="tag" error={error} ayuda="Ejemplo: 350 o 350,50">
                <input inputMode="decimal" value={texto} onChange={(e) => { setTexto(e.target.value); setError(null) }} placeholder="Ej: 350" maxLength={12} aria-label="Precio por kilómetro en pesos" />
              </Campo>
            </div>
            <div className="seccion">
              <p className="seccion-titulo">Monto mínimo por tamaño de encomienda</p>
              <p className="campo-ayuda">Dejá el campo vacío si no querés definir un mínimo para ese tamaño.</p>
              <div className="grilla-3">
                {TAMANOS_ENCOMIENDA.map(({ clave, etiqueta }) => (
                  <Campo key={clave} className="tarifa-minimo-campo" label={`Encomienda ${etiqueta.toLowerCase()} (pesos ARS)`} ayuda="Monto mínimo opcional">
                    <input
                      inputMode="decimal"
                      value={minimosTexto[clave]}
                      onChange={(e) => {
                        setMinimosTexto((actuales) => ({ ...actuales, [clave]: e.target.value }))
                        setError(null)
                      }}
                      placeholder="Sin mínimo"
                      maxLength={13}
                      aria-label={`Monto mínimo para encomienda ${etiqueta.toLowerCase()}`}
                    />
                  </Campo>
                ))}
              </div>
            </div>
          </div>
          <div className="card-pie">
            <button type="submit" className="btn btn-primario" disabled={guardando || guardado === undefined || minimosGuardados === null || Boolean(errorCarga) || sinCambios}>
              <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>

      </div>

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={() => setToast(null)} />}
    </section>
  )
}
