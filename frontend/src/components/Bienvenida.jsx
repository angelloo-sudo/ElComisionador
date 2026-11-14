import { useEffect, useRef, useState } from 'react'
import canguroBienvenida from '../assets/canguro-bienvenida.mp4'
import { Mascota } from './ui.jsx'

const ANCHO_MAXIMO = 280
const UMBRAL_TRANSPARENTE = 42
const UMBRAL_OPACO = 92

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
  const [animacionAlternativa, setAnimacionAlternativa] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(onCerrar, 3000)
    return () => window.clearTimeout(timer)
  }, [onCerrar])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const contexto = canvas?.getContext('2d', { willReadFrequently: true })
    if (!video || !canvas || !contexto) {
      setAnimacionAlternativa(true)
      return undefined
    }

    let frame = 0
    let activo = true
    let dimensiones = false
    let ultimoDibujo = 0

    function dibujar(tiempo) {
      if (!activo) return
      if (tiempo - ultimoDibujo >= 33 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
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
          for (let i = 0; i < pixeles.data.length; i += 4) {
            const distancia = Math.hypot(pixeles.data[i] - fondo[0], pixeles.data[i + 1] - fondo[1], pixeles.data[i + 2] - fondo[2])
            if (distancia <= UMBRAL_TRANSPARENTE) pixeles.data[i + 3] = 0
            else if (distancia < UMBRAL_OPACO) pixeles.data[i + 3] = Math.round(pixeles.data[i + 3] * (distancia - UMBRAL_TRANSPARENTE) / (UMBRAL_OPACO - UMBRAL_TRANSPARENTE))
          }
          contexto.putImageData(pixeles, 0, 0)
        } catch {
          activo = false
          setAnimacionAlternativa(true)
          return
        }
      }
      frame = window.requestAnimationFrame(dibujar)
    }

    function iniciar() {
      video.play().catch(alFallar)
      frame = window.requestAnimationFrame(dibujar)
    }

    video.addEventListener('loadeddata', iniciar, { once: true })
    const alFallar = () => {
      activo = false
      window.cancelAnimationFrame(frame)
      setAnimacionAlternativa(true)
    }
    video.addEventListener('error', alFallar, { once: true })
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) iniciar()
    return () => {
      activo = false
      window.cancelAnimationFrame(frame)
      video.removeEventListener('loadeddata', iniciar)
      video.removeEventListener('error', alFallar)
      video.pause()
    }
  }, [])

  return (
    <div className="bienvenida-overlay" role="status" aria-live="polite">
      <div className="bienvenida-contenido">
        <div className="bienvenida-mascota-wrap">
          <video ref={videoRef} className="bienvenida-video-fuente" src={canguroBienvenida} muted playsInline preload="auto" aria-hidden="true" />
          {animacionAlternativa
            ? <Mascota ancho={220} className="bienvenida-mascota-alternativa" />
            : <canvas ref={canvasRef} className="bienvenida-canguro" role="img" aria-label="Canguro de ComiTrack saludando" />}
        </div>
        <span className="bienvenida-etiqueta">COMITRACK</span>
        <h2>¡Te damos la bienvenida{nombre ? `, ${nombre}` : ''}!</h2>
        <p>Nos alegra tenerte acá</p>
        <button type="button" className="bienvenida-continuar" onClick={onCerrar}>Continuar</button>
      </div>
    </div>
  )
}
