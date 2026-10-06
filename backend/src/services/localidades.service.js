// Lista de localidades de Cordoba para origen/destino de los viajes.
// Se genera una vez con `npm --prefix backend run localidades` (ver scripts/generar-localidades.js).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ARCHIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/localidades-cordoba.json')

let cache = null

// Devuelve el array de localidades, o null si todavia no se genero el archivo.
export function obtenerLocalidades() {
  if (cache) return cache
  try {
    const datos = JSON.parse(readFileSync(ARCHIVO, 'utf8'))
    if (!Array.isArray(datos) || datos.length === 0) return null
    cache = { lista: datos, conjunto: new Set(datos) }
    return cache
  } catch {
    return null
  }
}

// null = la lista no esta disponible (no se puede validar); true/false = resultado.
export function esLocalidadValida(valor) {
  const datos = obtenerLocalidades()
  if (!datos) return null
  return typeof valor === 'string' && datos.conjunto.has(valor.trim())
}
