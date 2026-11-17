import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import canguroBienvenida from '../assets/canguro-bienvenida.mp4'

// El video se dibuja en un canvas quitándole el fondo, a un ancho intermedio para mantenerlo fluido.
const ANCHO_MAXIMO = 560
const MS_ENTRE_CUADROS = 33
const DURACION_BIENVENIDA_MS = 3000
const UMBRAL_TRANSPARENTE = 42
const UMBRAL_OPACO = 92
const UMBRAL_TRANSPARENTE_CUADRADO = UMBRAL_TRANSPARENTE * UMBRAL_TRANSPARENTE
const UMBRAL_OPACO_CUADRADO = UMBRAL_OPACO * UMBRAL_OPACO

function estimarFondo(imagen, ancho, alto) {
  const puntos = [
    [2, 2], [Math.floor(ancho / 2), 2], [ancho - 3, 2],
    [2, alto - 3], [ancho - 3, alto - 3],
  ]
  const suma = [0, 0, 0]
  puntos.forEach(([x, y]) => {
    const indice = (y * ancho + x) * 4
    suma[0] += imagen.data[indice]
    suma[1] += imagen.data[indice + 1]
    suma[2] += imagen.data[indice + 2]
  })
  return suma.map((canal) => canal / puntos.length)
}

export default function Bienvenida({ nombre, onCerrar }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cierreRealizado = useRef(false)
  const [canvasVisible, setCanvasVisible] = useState(false)

  const cerrarUnaVez = useCallback(() => {
    if (cierreRealizado.current) return
    cierreRealizado.current = true
    onCerrar()
  }, [onCerrar])

  useLayoutEffect(() => {
    const timer = window.setTimeout(cerrarUnaVez, DURACION_BIENVENIDA_MS)
    return () => window.clearTimeout(timer)
  }, [cerrarUnaVez])

  function omitir(event) {
    event.preventDefault()
    event.stopPropagation()
    cerrarUnaVez()
  }

  function manejarTecla(event) {
    if (event.key === 'Enter' || event.key === ' ') omitir(event)
  }

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const contexto = canvas?.getContext('2d', { willReadFrequently: true })
    if (!video || !canvas || !contexto) return undefined

    let frame = 0
    let activo = true
    let dimensiones = false
    let iniciando = false
    let reproduciendo = false
    let primerCuadro = false
    let ultimoDibujo = 0

    function detenerAnimacion() {
      activo = false
      reproduciendo = false
      window.cancelAnimationFrame(frame)
      video.pause()
      setCanvasVisible(false)
    }

    function dibujar(tiempo) {
      if (!activo || !reproduciendo) return
      if (tiempo - ultimoDibujo >= MS_ENTRE_CUADROS && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
        ultimoDibujo = tiempo
        try {
          if (!dimensiones) {
            canvas.width = Math.min(video.videoWidth, ANCHO_MAXIMO)
            canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth)
            dimensiones = true
          }
          contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
          const pixeles = contexto.getImageData(0, 0, canvas.width, canvas.height)
          const fondo = estimarFondo(pixeles, canvas.width, canvas.height)
          const datos = pixeles.data
          for (let i = 0; i < datos.length; i += 4) {
            const rojo = datos[i] - fondo[0]
            const verde = datos[i + 1] - fondo[1]
            const azul = datos[i + 2] - fondo[2]
            const distanciaCuadrada = rojo * rojo + verde * verde + azul * azul
            if (distanciaCuadrada <= UMBRAL_TRANSPARENTE_CUADRADO) datos[i + 3] = 0
            else if (distanciaCuadrada < UMBRAL_OPACO_CUADRADO) {
              const distancia = Math.sqrt(distanciaCuadrada)
              datos[i + 3] = Math.round(datos[i + 3] * (distancia - UMBRAL_TRANSPARENTE) / (UMBRAL_OPACO - UMBRAL_TRANSPARENTE))
            }
          }
          contexto.putImageData(pixeles, 0, 0)
        } catch (error) {
          console.error('No se pudo procesar el video de bienvenida.', error)
          detenerAnimacion()
          return
        }
        if (!primerCuadro) {
          primerCuadro = true
          setCanvasVisible(true)
        }
      }
      frame = window.requestAnimationFrame(dibujar)
    }

    function iniciar() {
      if (iniciando) return
      iniciando = true
      video.play().then(() => {
        if (!activo) return
        reproduciendo = true
        frame = window.requestAnimationFrame(dibujar)
      }).catch((error) => {
        console.error('No se pudo reproducir el video de bienvenida.', error)
        if (activo) detenerAnimacion()
      })
    }

    function errorDeVideo() {
      console.error('No se pudo cargar el video de bienvenida.', video.error)
      if (activo) detenerAnimacion()
    }

    video.addEventListener('loadeddata', iniciar, { once: true })
    video.addEventListener('error', errorDeVideo)
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) iniciar()
    return () => {
      activo = false
      window.cancelAnimationFrame(frame)
      video.removeEventListener('loadeddata', iniciar)
      video.removeEventListener('error', errorDeVideo)
      video.pause()
    }
  }, [])

  return (
    <div
      className="bienvenida-overlay"
      role="button"
      tabIndex={0}
      aria-label="Omitir animación y continuar al panel"
      aria-live="polite"
      onClick={omitir}
      onKeyDown={manejarTecla}
    >
      <div className="bienvenida-contenido">
        <div className="bienvenida-mascota-wrap">
          <video ref={videoRef} className="bienvenida-video-fuente" src={canguroBienvenida} muted playsInline preload="auto" aria-hidden="true" />
          <canvas ref={canvasRef} className={`bienvenida-canguro${canvasVisible ? ' visible' : ''}`} role="img" aria-label="Canguro de ComiTrack saludando" />
        </div>
        <span className="bienvenida-etiqueta">COMITRACK</span>
        <h2>¡Te damos la bienvenida{nombre ? `, ${nombre}` : ''}!</h2>
        <p>Nos alegra tenerte acá</p>
      </div>
    </div>
  )
}
