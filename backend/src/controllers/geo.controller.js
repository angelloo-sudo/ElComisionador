import { calcularRuta, validarDireccion } from '../services/geo.service.js'
import { esLocalidadValida } from '../services/localidades.service.js'

// Limite simple por usuario para no agotar las APIs publicas que usamos.
const ventanas = new Map()
function excedeLimite(usuarioId, max = 40, ms = 60_000) {
  const ahora = Date.now()
  const lista = (ventanas.get(usuarioId) ?? []).filter((t) => ahora - t < ms)
  lista.push(ahora)
  ventanas.set(usuarioId, lista)
  return lista.length > max
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '')

// GET /api/geo/ruta?origen=Cordoba&destino=Villa Carlos Paz
export async function ruta(req, res, next) {
  try {
    const origen = texto(req.query.origen)
    const destino = texto(req.query.destino)
    if (!origen || !destino) return res.status(400).json({ mensaje: 'Indicá el origen y el destino del viaje' })
    if (esLocalidadValida(origen) === false || esLocalidadValida(destino) === false) {
      return res.status(400).json({ mensaje: 'El origen o el destino no es una localidad válida' })
    }
    if (excedeLimite(req.usuario.id)) return res.status(429).json({ mensaje: 'Demasiadas consultas de mapa. Probá de nuevo en un minuto' })
    res.json(await calcularRuta(origen, destino))
  } catch (e) {
    res.status(503).json({ mensaje: 'No pudimos calcular la ruta en este momento. Probá de nuevo más tarde' })
  }
}

// POST /api/geo/validar-direccion  { calle, altura, localidad, codigo_postal (opcional) }
export async function validar(req, res, next) {
  try {
    const calle = texto(req.body?.calle)
    const altura = texto(req.body?.altura)
    const localidad = texto(req.body?.localidad)
    if (calle.length < 2 || calle.length > 100) return res.status(400).json({ mensaje: 'La calle es obligatoria (hasta 100 caracteres)' })
    if (!/^\d{1,6}$/.test(altura)) return res.status(400).json({ mensaje: 'La altura debe ser un número (hasta 6 dígitos)' })
    if (!localidad || localidad.length > 100) return res.status(400).json({ mensaje: 'Indicá la localidad' })
    if (excedeLimite(req.usuario.id)) return res.status(429).json({ mensaje: 'Demasiadas consultas. Probá de nuevo en un minuto' })
    const codigoPostal = texto(req.body?.codigo_postal).slice(0, 8)
    res.json(await validarDireccion({ calle, altura, localidad, codigoPostal }))
  } catch (e) { next(e) }
}
