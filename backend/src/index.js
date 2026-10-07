// Punto de entrada: arranca el servidor HTTP.
import 'dotenv/config'
import { app } from './app.js'
import { extenderSeries } from './services/viajes.service.js'

const PORT = process.env.PORT ?? 4000

app.listen(PORT, () => {
  console.log(`API de ComiTrack escuchando en http://localhost:${PORT}`)
})

// Los viajes repetitivos no tienen fecha de fin: al arrancar y cada 6 horas se completan
// las series hasta 3 meses hacia adelante. (Tambien se hace al listar los viajes.)
const SEIS_HORAS = 6 * 60 * 60 * 1000
async function mantenerSeries() {
  try {
    const creados = await extenderSeries()
    if (creados > 0) console.log(`Series de viajes extendidas: ${creados} viajes nuevos`)
  } catch (e) {
    console.error('No se pudieron extender las series de viajes:', e.message)
  }
}
mantenerSeries()
setInterval(mantenerSeries, SEIS_HORAS).unref()
