// Recursos del PDF de rentabilidad (fuente Inter y el canguro de ComiTrack), cargados como
// base64 solo cuando se descarga un PDF. Se guardan en memoria para las descargas siguientes.
import interRegular from '../assets/fuentes/Inter-Regular.ttf?url'
import interBold from '../assets/fuentes/Inter-Bold.ttf?url'
import canguro from '../assets/canguro-pdf.png'

async function comoBase64(url) {
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url}`)
  const bytes = new Uint8Array(await respuesta.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

let promesa = null

export function cargarRecursosPdf() {
  promesa ??= Promise.all([comoBase64(interRegular), comoBase64(interBold), comoBase64(canguro)])
    .then(([regular, bold, logo]) => ({ fuentes: { regular, bold }, logo: `data:image/png;base64,${logo}` }))
    .catch((error) => { promesa = null; throw error })
  return promesa
}
