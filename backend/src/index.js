// Punto de entrada: arranca el servidor HTTP.
import 'dotenv/config'
import { app } from './app.js'

const PORT = process.env.PORT ?? 4000

app.listen(PORT, () => {
  console.log(`API de ComiTrack escuchando en http://localhost:${PORT}`)
})
