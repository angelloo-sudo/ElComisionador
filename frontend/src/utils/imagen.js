// Prepara la foto de perfil en el navegador: la recorta a cuadrado (centrada), la achica y
// la convierte a JPEG, asi pesa ~20-60 KB en vez de varios MB y se puede guardar en la base.
const LADO_MAXIMO = 320
const PESO_MAXIMO_ORIGINAL = 10 * 1024 * 1024 // 10 MB: lo que se acepta elegir
const LONGITUD_MAXIMA = 250_000 // caracteres del data URL (el backend acepta hasta 400.000)
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp']

export const ACEPTA_FOTOS = TIPOS_ACEPTADOS.join(',')

export async function prepararFotoPerfil(archivo) {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new Error('La foto tiene que ser JPG, PNG o WebP.')
  }
  if (archivo.size > PESO_MAXIMO_ORIGINAL) {
    throw new Error('La imagen es demasiado grande (máximo 10 MB).')
  }

  let imagen
  try {
    imagen = await createImageBitmap(archivo)
  } catch {
    throw new Error('No se pudo leer la imagen. Probá con otra foto.')
  }

  const ladoOrigen = Math.min(imagen.width, imagen.height)
  const lado = Math.min(LADO_MAXIMO, ladoOrigen)
  const lienzo = document.createElement('canvas')
  lienzo.width = lado
  lienzo.height = lado

  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#fff' // los PNG con transparencia no quedan con fondo negro al pasar a JPEG
  ctx.fillRect(0, 0, lado, lado)
  ctx.drawImage(
    imagen,
    (imagen.width - ladoOrigen) / 2, (imagen.height - ladoOrigen) / 2, ladoOrigen, ladoOrigen,
    0, 0, lado, lado,
  )
  imagen.close?.()

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
