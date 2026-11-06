import { useEffect, useRef, useState } from 'react'

const PASOS = [
  { id: 'frente-inicial', titulo: 'Mirá al frente', detalle: 'Ubicá el rostro dentro del óvalo y mantené los ojos abiertos.' },
  { id: 'parpadeo', titulo: 'Parpadeá', detalle: 'Abrí los ojos y luego parpadeá una vez.' },
  { id: 'giro', titulo: 'Girate un poco', detalle: 'Mové suavemente la cabeza hacia cualquiera de los dos lados.' },
  { id: 'frente-final', titulo: 'Volvé al frente', detalle: 'Volvé a mirar la cámara unos segundos.' },
]

const NUEVO_ESTADO = { rostro_unico: false, parpadeo: false, giro: false, frente: false }

function puntaje(expresiones, nombre) {
  return expresiones?.categories?.find((c) => c.categoryName === nombre)?.score ?? 0
}

function desvioCabeza(puntos) {
  if (!puntos || puntos.length < 455) return null
  const ojoIzq = (puntos[33].x + puntos[133].x) / 2
  const ojoDer = (puntos[362].x + puntos[263].x) / 2
  const anchoOjos = Math.abs(ojoDer - ojoIzq)
  if (anchoOjos < 0.01) return null
  const centro = (ojoIzq + ojoDer) / 2
  return (puntos[1].x - centro) / anchoOjos
}

export default function DesafioFacial({ onCompleto }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const frameRef = useRef(0)
  const activoRef = useRef(false)
  const montadoRef = useRef(true)
  const pasoRef = useRef(0)
  const parpadeoAbiertoRef = useRef(false)
  const frenteFramesRef = useRef(0)
  const giroFramesRef = useRef(0)
  const [iniciado, setIniciado] = useState(false)
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [rostroDetectado, setRostroDetectado] = useState(false)
  const [resultado, setResultado] = useState(NUEVO_ESTADO)

  function detenerCamara() {
    activoRef.current = false
    cancelAnimationFrame(frameRef.current)
    detectorRef.current?.close()
    detectorRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      detenerCamara()
    }
  }, [])

  async function empezar() {
    setError('')
    setCargando(true)
    setResultado(NUEVO_ESTADO)
    setRostroDetectado(false)
    setPaso(0)
    pasoRef.current = 0
    frenteFramesRef.current = 0
    giroFramesRef.current = 0
    parpadeoAbiertoRef.current = false
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite acceder a la cámara.')
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      if (!montadoRef.current) return
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (!montadoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm/', true)
      const detector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 2,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.65,
        minFacePresenceConfidence: 0.65,
        minTrackingConfidence: 0.6,
      })
      if (!montadoRef.current) {
        detector.close()
        detenerCamara()
        return
      }
      detectorRef.current = detector
      activoRef.current = true
      setIniciado(true)
      setCargando(false)

      const analizar = () => {
        if (!activoRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = requestAnimationFrame(analizar)
          return
        }
        try {
          const deteccion = detectorRef.current.detectForVideo(videoRef.current, performance.now())
          const rostros = deteccion.faceLandmarks || []
          if (rostros.length > 1) {
            setError('Se detectaron varios rostros. Repetí la comprobación en un lugar donde estés a solas.')
            setIniciado(false)
            detenerCamara()
            return
          }
          if (rostros.length === 1) {
            setRostroDetectado(true)
            setResultado((actual) => actual.rostro_unico ? actual : { ...actual, rostro_unico: true })
            const indice = pasoRef.current
            const expresiones = deteccion.faceBlendshapes?.[0]
            const ojosCerrados = puntaje(expresiones, 'eyeBlinkLeft') > 0.48 && puntaje(expresiones, 'eyeBlinkRight') > 0.48
            const ojosAbiertos = puntaje(expresiones, 'eyeBlinkLeft') < 0.23 && puntaje(expresiones, 'eyeBlinkRight') < 0.23
            const yaw = desvioCabeza(rostros[0])

            if (indice === 0 && yaw !== null && Math.abs(yaw) < 0.13 && ojosAbiertos) {
              frenteFramesRef.current += 1
              if (frenteFramesRef.current >= 8) avanzar(1)
            } else if (indice === 0) frenteFramesRef.current = 0

            if (indice === 1) {
              if (ojosAbiertos) parpadeoAbiertoRef.current = true
              if (parpadeoAbiertoRef.current && ojosCerrados) {
                setResultado((actual) => ({ ...actual, parpadeo: true }))
                avanzar(2)
              }
            }

            if (indice === 2 && yaw !== null && Math.abs(yaw) > 0.12) {
              giroFramesRef.current += 1
              if (giroFramesRef.current >= 5) {
                setResultado((actual) => ({ ...actual, giro: true }))
                avanzar(3)
              }
            } else if (indice === 2) giroFramesRef.current = 0

            if (indice === 3 && yaw !== null && Math.abs(yaw) < 0.08) {
              frenteFramesRef.current += 1
              if (frenteFramesRef.current >= 8) {
                const final = { rostro_unico: true, parpadeo: true, giro: true, frente: true }
                const video = videoRef.current
                const canvas = document.createElement('canvas')
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const contexto = canvas.getContext('2d')
                if (!canvas.width || !canvas.height || !contexto) {
                  setError('No pudimos capturar una vista previa. Repetí la comprobación.')
                  setIniciado(false)
                  detenerCamara()
                  return
                }
                contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
                canvas.toBlob((captura) => {
                  if (!montadoRef.current) return
                  if (!captura) {
                    setError('No pudimos capturar una vista previa. Repetí la comprobación.')
                    setIniciado(false)
                    detenerCamara()
                    return
                  }
                  setResultado(final)
                  setIniciado(false)
                  detenerCamara()
                  onCompleto(final, captura)
                }, 'image/jpeg', 0.88)
                return
              }
            } else if (indice === 3) frenteFramesRef.current = 0
          } else {
            setRostroDetectado(false)
            frenteFramesRef.current = 0
            giroFramesRef.current = 0
          }
        } catch {
          setError('No pudimos analizar la cámara. Revisá el encuadre e intentá de nuevo.')
          setIniciado(false)
          detenerCamara()
          return
        }
        frameRef.current = requestAnimationFrame(analizar)
      }

      function avanzar(siguiente) {
        pasoRef.current = siguiente
        frenteFramesRef.current = 0
        giroFramesRef.current = 0
        setPaso(siguiente)
      }

      analizar()
    } catch (e) {
      detenerCamara()
      if (montadoRef.current) {
        setIniciado(false)
        setError(e?.name === 'NotAllowedError'
          ? 'No se autorizó la cámara. Habilitala en el navegador y volvé a intentar.'
          : (e?.message || 'No se pudo iniciar la cámara en este dispositivo.'))
      }
    } finally {
      if (montadoRef.current) setCargando(false)
    }
  }

  const completado = resultado.frente && resultado.parpadeo && resultado.giro && resultado.rostro_unico
  return (
    <div className="verif-selfie">
      <div className="verif-video-marco">
        <video ref={videoRef} className="verif-video" playsInline muted aria-label="Vista previa de la cámara frontal" />
        <span className="verif-ovalo" aria-hidden="true" />
        {!iniciado && !completado && <span className="verif-video-ayuda">La cámara solo se usa durante esta comprobación</span>}
      </div>
      <ol className="verif-pasos-faciales">
        {PASOS.map((item, indice) => (
          <li key={item.id} className={indice < paso || completado ? 'listo' : indice === paso && iniciado ? 'actual' : ''}>
            <span>{indice < paso || completado ? '✓' : indice + 1}</span>
            <div><strong>{item.titulo}</strong><small>{item.detalle}</small></div>
          </li>
        ))}
      </ol>
      {iniciado && <p className={`verif-deteccion ${rostroDetectado ? 'detectado' : ''}`} role="status">{rostroDetectado ? 'Un rostro está dentro del encuadre.' : 'Aún no detectamos un rostro; centrate dentro del óvalo.'}</p>}
      {error && <p className="verif-error" role="alert">{error}</p>}
      {completado
        ? <p className="verif-exito" role="status">Comprobación de movimientos completada. No es una prueba de vida robusta.</p>
        : <button type="button" className="btn btn-primario" onClick={empezar} disabled={cargando || iniciado}>
          {cargando ? 'Preparando cámara…' : iniciado ? PASOS[paso]?.titulo || 'Comprobando…' : error ? 'Repetir comprobación' : 'Iniciar comprobación facial'}
        </button>}
    </div>
  )
}
