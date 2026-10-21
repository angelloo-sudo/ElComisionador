// Mapas y direcciones.
//  - Validacion de calle + altura: API Georef (Estado argentino, datos oficiales de calles).
//  - Codigo postal sugerido: Nominatim de OpenStreetMap (geocodificacion inversa), solo como ayuda.
//  - Ruta entre dos localidades: OSRM sobre datos de OpenStreetMap.
// Todas son gratuitas y publicas. Para no abusar de ellas se cachean los resultados en memoria
// y las consultas a Nominatim se espacian (su politica pide como maximo 1 por segundo).
const GEOREF = process.env.GEOREF_URL ?? 'https://apis.datos.gob.ar/georef/api'
const OSRM = process.env.OSRM_URL ?? 'https://router.project-osrm.org'
const NOMINATIM = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
const USER_AGENT = process.env.GEO_USER_AGENT ?? 'ComiTrack/1.0 (proyecto academico UTN-FRC)'
const PROVINCIA = 'Córdoba'

const UN_DIA = 24 * 60 * 60 * 1000
const cache = new Map()
function deCache(clave) {
  const e = cache.get(clave)
  if (!e) return undefined
  if (e.vence < Date.now()) { cache.delete(clave); return undefined }
  return e.valor
}
function aCache(clave, valor, ttl = UN_DIA) {
  if (cache.size > 2000) cache.clear()
  cache.set(clave, { valor, vence: Date.now() + ttl })
  return valor
}
export function limpiarCache() { cache.clear() }

async function pedirJson(url, { timeout = 8000 } = {}) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controlador.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// ---------------------------------------------------------------- localidades y ruta

// Las localidades repetidas se nombran con su departamento entre parentesis: "Córdoba (Capital)",
// "La Calera (Colón)". Para Georef hay que pasar el nombre y el departamento por separado.
export function partirLocalidad(nombre) {
  const completo = String(nombre ?? '').trim()
  const m = completo.match(/^(.*?)\s*\(([^)]+)\)\s*(?:-.*)?$/)
  return m && m[1].trim() ? { completo, base: m[1].trim(), depto: m[2].trim() } : { completo, base: completo, depto: null }
}

async function buscarLocalidades(nombre, departamento) {
  const params = new URLSearchParams({ provincia: PROVINCIA, nombre, max: '20' })
  if (departamento) params.set('departamento', departamento)
  const datos = await pedirJson(`${GEOREF}/localidades?${params}`)
  return (datos.localidades ?? []).filter((l) => l.centroide && Number.isFinite(l.centroide.lat) && Number.isFinite(l.centroide.lon))
}

// Centro de una localidad de Cordoba: { nombre, lat, lon }. Lanza Error si no se puede obtener.
export async function centroLocalidad(nombre) {
  const clave = `loc:${sinTildes(nombre)}`
  const guardado = deCache(clave)
  if (guardado) return guardado
  const { completo, base, depto } = partirLocalidad(nombre)
  const objetivo = sinTildes(base)
  let elegida = null
  if (depto) {
    const lista = await buscarLocalidades(base, depto)
    elegida = lista.find((l) => sinTildes(l.nombre) === objetivo) ?? lista[0] ?? null
  }
  if (!elegida) {
    const lista = await buscarLocalidades(base)
    elegida = lista.find((l) => sinTildes(l.nombre) === objetivo) ?? null
  }
  if (!elegida && completo !== base) {
    const lista = await buscarLocalidades(completo)
    elegida = lista[0] ?? null
  }
  if (!elegida) throw new Error(`No se encontró la localidad "${nombre}"`)
  return aCache(clave, { nombre, lat: elegida.centroide.lat, lon: elegida.centroide.lon })
}

const rad = (g) => (g * Math.PI) / 180
export function distanciaKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Ruta en auto entre dos localidades. Si OSRM no responde se devuelve una linea recta
// (aproximada: true) para que igual se vean los dos puntos.
export async function calcularRuta(origenNombre, destinoNombre) {
  const clave = `ruta:${sinTildes(origenNombre)}>${sinTildes(destinoNombre)}`
  const guardado = deCache(clave)
  if (guardado) return guardado
  const [origen, destino] = await Promise.all([centroLocalidad(origenNombre), centroLocalidad(destinoNombre)])
  let resultado
  try {
    const url = `${OSRM}/route/v1/driving/${origen.lon},${origen.lat};${destino.lon},${destino.lat}?overview=simplified&geometries=geojson`
    const datos = await pedirJson(url, { timeout: 10000 })
    const ruta = datos.routes?.[0]
    if (datos.code !== 'Ok' || !ruta?.geometry?.coordinates?.length) throw new Error('Sin ruta')
    resultado = {
      origen, destino, aproximada: false,
      distancia_km: Math.round(ruta.distance / 100) / 10,
      duracion_min: Math.round(ruta.duration / 60),
      geometria: ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    }
  } catch {
    resultado = {
      origen, destino, aproximada: true,
      distancia_km: Math.round(distanciaKm(origen, destino) * 10) / 10,
      duracion_min: null,
      geometria: [[origen.lat, origen.lon], [destino.lat, destino.lon]],
    }
    return aCache(clave, resultado, 5 * 60 * 1000) // si fallo, reintenta pronto
  }
  return aCache(clave, resultado)
}

const coordsOsrm = (puntos) => puntos.map((p) => `${p.lon},${p.lat}`).join(';')

// Ruta en auto que pasa por los puntos { lat, lon } en el orden dado (por ejemplo, dos paradas, o el
// recorrido completo con todas sus paradas). Lanza Error si OSRM no responde.
// Devuelve { distancia_km, duracion_min, geometria: [[lat, lon], ...] }.
export async function calcularRutaPorPuntos(puntos) {
  const clave = `rutap:${puntos.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('>')}`
  const guardado = deCache(clave)
  if (guardado) return guardado
  const url = `${OSRM}/route/v1/driving/${coordsOsrm(puntos)}?overview=simplified&geometries=geojson`
  const datos = await pedirJson(url, { timeout: 10000 })
  const ruta = datos.routes?.[0]
  if (datos.code !== 'Ok' || !ruta?.geometry?.coordinates?.length) throw new Error('Sin ruta')
  return aCache(clave, {
    distancia_km: Math.round(ruta.distance / 100) / 10,
    duracion_min: Math.round(ruta.duration / 60),
    geometria: ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  })
}

export const calcularRutaEntrePuntos = (a, b) => calcularRutaPorPuntos([a, b])

// Matriz de distancias en auto (km) entre todos los puntos: m[i][j] = km de ir del punto i al j.
// Una sola consulta a OSRM. Lanza Error si no responde.
export async function calcularMatrizKm(puntos) {
  const clave = `matriz:${puntos.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('>')}`
  const guardado = deCache(clave)
  if (guardado) return guardado
  const datos = await pedirJson(`${OSRM}/table/v1/driving/${coordsOsrm(puntos)}?annotations=distance`, { timeout: 10000 })
  const d = datos.distances
  if (datos.code !== 'Ok' || !Array.isArray(d) || d.length !== puntos.length || d.some((f) => f.some((x) => !Number.isFinite(x)))) {
    throw new Error('Sin matriz de distancias')
  }
  return aCache(clave, d.map((fila) => fila.map((m) => m / 1000)))
}

// ---------------------------------------------------------------- direcciones

async function buscarDirecciones(direccion, filtros) {
  const params = new URLSearchParams({ direccion, provincia: PROVINCIA, max: '1', ...filtros })
  const datos = await pedirJson(`${GEOREF}/direcciones?${params}`)
  return datos.direcciones ?? []
}

// Codigo postal sugerido (postcode de OpenStreetMap). Es solo una ayuda: puede devolver null.
let colaNominatim = Promise.resolve()
function espaciar(fn, ms = 1100) {
  const turno = colaNominatim.then(fn, fn)
  colaNominatim = turno.then(() => new Promise((r) => setTimeout(r, ms)), () => new Promise((r) => setTimeout(r, ms)))
  return turno
}
// Deja solo el codigo postal argentino: 4 digitos (5000) o CPA (X5000ABC). Cualquier otra cosa -> null.
export function limpiarCodigoPostal(valor) {
  const t = String(valor ?? '').replace(/\s+/g, '').toUpperCase()
  if (/^[A-Z]\d{4}[A-Z]{3}$/.test(t)) return t
  return t.match(/\d{4}/)?.[0] ?? null
}
export async function codigoPostalDe(lat, lon) {
  const clave = `cp:${lat.toFixed(4)},${lon.toFixed(4)}`
  const guardado = deCache(clave)
  if (guardado !== undefined) return guardado
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lon}`
    const datos = await espaciar(() => pedirJson(url, { timeout: 4000 }))
    const a = datos.address ?? {}
    return aCache(clave, limpiarCodigoPostal(a.postcode))
  } catch {
    return null
  }
}

// Plan B para direcciones que Georef no tiene (pasa en pueblos y calles nuevas): se busca en OpenStreetMap
// (Nominatim) con calle, altura, localidad y, si hay, el codigo postal. Solo se acepta un resultado que caiga
// en la localidad elegida de Cordoba, para no marcar una direccion equivocada. Devuelve null si no hay nada.
async function buscarEnNominatim({ calle, altura, localidad, codigoPostal }) {
  const { base } = partirLocalidad(localidad)
  const objetivo = sinTildes(base)
  const cp4 = limpiarCodigoPostal(codigoPostal)?.match(/\d{4}/)?.[0]
  const comun = { format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'ar', 'accept-language': 'es' }
  const intentos = [
    new URLSearchParams({ ...comun, street: `${altura} ${calle}`, city: base, state: PROVINCIA, country: 'Argentina', ...(cp4 ? { postalcode: cp4 } : {}) }),
    new URLSearchParams({ ...comun, q: `${calle} ${altura}, ${base}, ${PROVINCIA}, Argentina` }),
  ]
  for (const params of intentos) {
    let lista
    try {
      lista = await espaciar(() => pedirJson(`${NOMINATIM}/search?${params}`, { timeout: 6000 }))
    } catch { continue }
    for (const item of Array.isArray(lista) ? lista : []) {
      const a = item.address ?? {}
      const lugares = [a.city, a.town, a.village, a.municipality, a.hamlet, a.suburb, a.city_district].filter(Boolean).map(sinTildes)
      const enCordoba = !a.state || sinTildes(a.state).includes('cordoba')
      const lat = Number(item.lat)
      const lon = Number(item.lon)
      if (enCordoba && lugares.includes(objetivo) && Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon, nomenclatura: item.display_name ?? null, codigo_postal: limpiarCodigoPostal(a.postcode) }
      }
    }
  }
  return null
}

// Estados posibles:
//  ok                  la calle y la altura existen en esa localidad (coordenadas confirmadas)
//  altura_no_confirmada la calle existe en la localidad pero no se pudo ubicar esa altura
//  otra_localidad      la direccion existe en Cordoba pero en otra localidad
//  no_encontrada       no existe esa calle en la provincia
//  no_verificable      el servicio no respondio: no se bloquea al usuario
export async function validarDireccion({ calle, altura, localidad, codigoPostal }, { conCodigoPostal = true } = {}) {
  const direccion = `${String(calle).trim().replace(/\s+/g, ' ')} ${String(altura).trim()}`
  const clave = `dir:${sinTildes(direccion)}|${sinTildes(localidad)}|${conCodigoPostal}|${limpiarCodigoPostal(codigoPostal) ?? ''}`
  const guardado = deCache(clave)
  if (guardado) return guardado
  try {
    const { base, depto } = partirLocalidad(localidad)
    const filtros = []
    if (depto) filtros.push({ localidad: base, departamento: depto }, { localidad_censal: base, departamento: depto })
    filtros.push({ localidad: base }, { localidad_censal: base })
    let hallada = null
    for (const filtro of filtros) {
      const r = await buscarDirecciones(direccion, filtro)
      if (r[0]) { hallada = r[0]; break }
    }
    let resultado
    if (hallada) {
      const ubicada = Number.isFinite(hallada.ubicacion?.lat) && Number.isFinite(hallada.ubicacion?.lon)
      resultado = {
        estado: ubicada ? 'ok' : 'altura_no_confirmada',
        direccion_normalizada: hallada.nomenclatura ?? null,
        lat: ubicada ? hallada.ubicacion.lat : null,
        lon: ubicada ? hallada.ubicacion.lon : null,
        codigo_postal_sugerido: ubicada && conCodigoPostal ? await codigoPostalDe(hallada.ubicacion.lat, hallada.ubicacion.lon) : null,
      }
    } else {
      const enProvincia = (await buscarDirecciones(direccion, {}))[0]
      resultado = enProvincia
        ? { estado: 'otra_localidad', direccion_normalizada: enProvincia.nomenclatura ?? null, lat: null, lon: null, codigo_postal_sugerido: null }
        : { estado: 'no_encontrada', direccion_normalizada: null, lat: null, lon: null, codigo_postal_sugerido: null }
    }
    if (resultado.estado !== 'ok') {
      // Georef no la ubica en esa localidad: se prueba en OpenStreetMap.
      const osm = await buscarEnNominatim({ calle, altura, localidad, codigoPostal })
      if (osm) {
        resultado = {
          estado: 'ok', fuente: 'osm', direccion_normalizada: osm.nomenclatura, lat: osm.lat, lon: osm.lon,
          codigo_postal_sugerido: conCodigoPostal ? osm.codigo_postal : null,
        }
      }
    }
    return aCache(clave, resultado, 6 * 60 * 60 * 1000)
  } catch {
    return { estado: 'no_verificable', direccion_normalizada: null, lat: null, lon: null, codigo_postal_sugerido: null }
  }
}
