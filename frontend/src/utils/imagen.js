// Prepara la foto de perfil en el navegador: la recorta a cuadrado, la achica y la convierte
// a JPEG, asi pesa ~20-60 KB en vez de varios MB y se puede guardar en la base.
const LADO_MAXIMO = 320
const PESO_MAXIMO_ORIGINAL = 10 * 1024 * 1024 // 10 MB: lo que se acepta elegir
const LONGITUD_MAXIMA = 250_000 // caracteres del data URL (el backend acepta hasta 400.000)
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp']

export const ACEPTA_FOTOS = TIPOS_ACEPTADOS.join(',')

// Controla tipo y peso del archivo elegido antes de abrir el ajuste.
export function validarArchivoFoto(archivo) {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new Error('La foto tiene que ser JPG, PNG o WebP.')
  }
  if (archivo.size > PESO_MAXIMO_ORIGINAL) {
    throw new Error('La imagen es demasiado grande (máximo 10 MB).')
  }
}

// Recorta el cuadrado elegido (sx, sy, lado en pixeles de la imagen original) y lo
// devuelve como data URL JPEG liviano. "imagen" puede ser un <img> o un ImageBitmap.
export function recortarFotoPerfil(imagen, { sx, sy, lado: ladoOrigen }) {
  const lado = Math.max(1, Math.round(Math.min(LADO_MAXIMO, ladoOrigen)))
  const lienzo = document.createElement('canvas')
  lienzo.width = lado
  lienzo.height = lado

  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#fff' // los PNG con transparencia no quedan con fondo negro al pasar a JPEG
  ctx.fillRect(0, 0, lado, lado)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagen, sx, sy, ladoOrigen, ladoOrigen, 0, 0, lado, lado)

  let calidad = 0.85
  let resultado = lienzo.toDataURL('image/jpeg', calidad)
  while (resultado.length > LONGITUD_MAXIMA && calidad > 0.4) {
    calidad -= 0.1
    resultado = lienzo.toDataURL('image/jpeg', calidad)
  }
  if (resultado.length > LONGITUD_MAXIMA) {
    throw new Error('No se pudo achicar lo suficiente la imagen. Probá con otra foto.')
  }
  return resultado
}

// Recorte automatico centrado (sin ajuste manual).
export async function prepararFotoPerfil(archivo) {
  validarArchivoFoto(archivo)
  let imagen
  try {
    imagen = await createImageBitmap(archivo)
  } catch {
    throw new Error('No se pudo leer la imagen. Probá con otra foto.')
  }
  const lado = Math.min(imagen.width, imagen.height)
  try {
    return recortarFotoPerfil(imagen, { sx: (imagen.width - lado) / 2, sy: (imagen.height - lado) / 2, lado })
  } finally {
    imagen.close?.()
  }
}
