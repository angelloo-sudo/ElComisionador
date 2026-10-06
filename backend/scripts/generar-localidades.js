// Descarga UNA sola vez las localidades de la provincia de Cordoba desde Georef
// (API oficial del Estado argentino, datos INDEC/IGN) y las guarda en
// src/data/localidades-cordoba.json, que es lo que usa el desplegable de viajes.
//
// Uso (desde la raiz del proyecto):   npm --prefix backend run localidades
// Despues hay que commitear el JSON generado para que todo el equipo tenga la misma lista.
// Requiere Node 18 o superior (usa fetch nativo).
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const URL_API =
  'https://apis.datos.gob.ar/georef/api/localidades' +
  `?provincia=${encodeURIComponent('Córdoba')}` +
  '&campos=nombre,departamento.nombre&aplanar=true&max=1000&orden=nombre'

const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/localidades-cordoba.json')

// Minimo razonable: Georef informa 514 para Cordoba. Si viene mucho menos,
// algo fallo y preferimos no pisar el archivo bueno.
const MINIMO_ESPERADO = 400

const respuesta = await fetch(URL_API)
if (!respuesta.ok) {
  console.error(`Georef respondio ${respuesta.status}. No se genero el archivo.`)
  process.exit(1)
}

const { localidades, total } = await respuesta.json()
if (!Array.isArray(localidades) || localidades.length < MINIMO_ESPERADO) {
  console.error(`Se esperaban al menos ${MINIMO_ESPERADO} localidades y llegaron ${localidades?.length ?? 0}. No se genero el archivo.`)
  process.exit(1)
}

// Si el nombre se repite en distintos departamentos, el valor incluye el departamento
// (ej: "San José (Colón)") para que no haya ambiguedad. Si es unico, queda solo el nombre.
const repeticiones = new Map()
for (const l of localidades) {
  repeticiones.set(l.nombre, (repeticiones.get(l.nombre) ?? 0) + 1)
}

const etiquetas = new Set(
  localidades.map((l) =>
    repeticiones.get(l.nombre) > 1 && l.departamento_nombre
      ? `${l.nombre} (${l.departamento_nombre})`
      : l.nombre
  )
)

const ordenadas = [...etiquetas].sort((a, b) => a.localeCompare(b, 'es'))

await mkdir(path.dirname(SALIDA), { recursive: true })
await writeFile(SALIDA, JSON.stringify(ordenadas, null, 2) + '\n', 'utf8')

console.log(`Listo: ${ordenadas.length} localidades guardadas (Georef informa total=${total}).`)
console.log(`Archivo: ${SALIDA}`)
