import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, formatoFecha } from '../components/ui.jsx'
import { compararPerfil, enmascararDni, extraerDatosPDF417, formatearEstadoVerificacion } from '../utils/verificacion.js'
import '../styles/verificacion.css'

const ERROR_LECTURA = 'No pudimos leer los datos del DNI. Asegurate de enfocar correctamente el código y volvé a intentarlo.'
const ERROR_COINCIDENCIA = 'Los datos del DNI no coinciden con los de tu registro. Revisalos e intentá nuevamente.'

function EstadoPill({ estado }) {
  const clase = estado === 'APROBADA_MANUALMENTE' ? 'exito' : ['RECHAZADA', 'REQUIERE_CORRECCION'].includes(estado) ? 'atencion' : 'pendiente'
  return <span className={`verif-pill ${clase}`}>{formatearEstadoVerificacion(estado)}</span>
}

export default function VerificacionIdentidad({ perfilRegistro, tokenVerificacion, onRegistroCompleto, onCancelarRegistro, onTokenInvalido }) {
  const registro = Boolean(perfilRegistro)
  const videoRef = useRef(null)
  const controlesRef = useRef(null)
  const lectorRef = useRef(null)
  const temporizadorRef = useRef(null)
  const sesionEscaneoRef = useRef(0)
  const [perfil, setPerfil] = useState(perfilRegistro || null)
  const [solicitudes, setSolicitudes] = useState([])
  const [solicitudId, setSolicitudId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [consentimiento, setConsentimiento] = useState(false)
  const [etapa, setEtapa] = useState(registro ? 'consentimiento' : 'inicio')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [coincidencias, setCoincidencias] = useState(null)
  const [error, setError] = useState('')

  // @zxing/browser no tiene reset(): la cámara se libera con controles.stop().
  function detenerCamara() {
    sesionEscaneoRef.current += 1
    clearTimeout(temporizadorRef.current)
    temporizadorRef.current = null
    try { controlesRef.current?.stop() } catch { /* la cámara ya estaba detenida */ }
    controlesRef.current = null
    lectorRef.current = null
    setCamaraActiva(false)
  }

  useEffect(() => () => {
    sesionEscaneoRef.current += 1
    clearTimeout(temporizadorRef.current)
    try { controlesRef.current?.stop() } catch { /* la cámara ya estaba detenida */ }
  }, [])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        if (registro) {
          const [cuenta, estado] = await Promise.all([
            api.get('/verificaciones/registro/perfil', { token: tokenVerificacion }),
            api.get('/verificaciones/registro/estado', { token: tokenVerificacion }),
          ])
          if (!vigente) return
          setPerfil(cuenta)
          if (estado?.estado === 'EN_PROCESO') setSolicitudId(estado.id)
          if (estado?.estado === 'PENDIENTE_REVISION') setEtapa('revision')
        } else {
          const [cuenta, historial] = await Promise.all([api.get('/auth/perfil'), api.get('/verificaciones/mias')])
          if (!vigente) return
          setPerfil(cuenta)
          setSolicitudes(historial)
          const activa = historial.find((s) => s.estado === 'EN_PROCESO' || s.estado === 'PENDIENTE_REVISION')
          if (activa?.estado === 'EN_PROCESO') setSolicitudId(activa.id)
        }
      } catch (e) {
        if (vigente) {
          setError('No pudimos consultar el estado de tu verificación. Volvé a intentarlo más tarde.')
          if (registro && [401, 403].includes(e.status)) onTokenInvalido?.()
        }
      } finally { if (vigente) setCargando(false) }
    }
    cargar()
    return () => { vigente = false }
  }, [registro, tokenVerificacion])

  async function enviarDatosDocumento(leidos) {
    setProcesando(true)
    setError('')
    try {
      let id = solicitudId
      if (!id) {
        const nueva = await api.post('/verificaciones', { consentimiento: true }, registro ? { token: tokenVerificacion } : undefined)
        id = nueva.id
        setSolicitudId(id)
      }
      const resultado = await api.patch(`/verificaciones/${id}/documento`, leidos, registro ? { token: tokenVerificacion } : undefined)
      setDatos({ dni: leidos.dni, nombre: leidos.nombre, apellido: leidos.apellido })
      setCoincidencias(resultado.coincidencias)
      if (resultado.resultado !== 'LECTURA_CORRECTA_Y_COINCIDENTE') {
        setEtapa('resultado')
        setError(ERROR_COINCIDENCIA)
        return
      }
      const solicitud = await api.patch(`/verificaciones/${id}/enviar`, {}, registro ? { token: tokenVerificacion } : undefined)
      setDatos(null)
      setCoincidencias(null)
      setEtapa('revision')
      if (registro) onRegistroCompleto?.(solicitud)
      else {
        const historial = await api.get('/verificaciones/mias')
        setSolicitudes(historial)
      }
    } catch (e) {
      if (e.respuesta?.resultado === 'DATOS_NO_COINCIDENTES' || e.respuesta?.resultado === 'LECTURA_INCOMPLETA') {
        setDatos(leidos)
        setCoincidencias(e.respuesta.coincidencias)
        setError(ERROR_COINCIDENCIA)
        setEtapa('resultado')
      } else {
        setError('No pudimos enviar la solicitud. Revisá tu conexión y volvé a intentarlo.')
        setEtapa('resultado')
      }
    } finally { setProcesando(false) }
  }

  async function comenzarEscaneo() {
    const sesionEscaneo = ++sesionEscaneoRef.current
    setError('')
    setDatos(null)
    setCoincidencias(null)
    setEtapa('escanear')
    setCamaraActiva(true)
    try {
      const { BrowserPDF417Reader } = await import('@zxing/browser')
      await new Promise((resolver) => requestAnimationFrame(resolver))
      if (sesionEscaneo !== sesionEscaneoRef.current) return
      // TRY_HARDER (clave 3 de DecodeHintType) mejora la lectura del código del DNI, que es muy denso.
      const lector = new BrowserPDF417Reader(new Map([[3, true]]), { delayBetweenScanAttempts: 150 })
      lectorRef.current = lector
      // Cámara trasera en celulares y alta resolución: con 640x480 el PDF417 casi nunca se lee.
      const restricciones = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }
      const controles = await lector.decodeFromConstraints(restricciones, videoRef.current, (resultado) => {
        if (!resultado || !lectorRef.current || sesionEscaneo !== sesionEscaneoRef.current) return
        const leidos = extraerDatosPDF417(resultado.getText())
        detenerCamara()
        if (!leidos) {
          setError(ERROR_LECTURA)
          setEtapa('resultado')
          return
        }
        void enviarDatosDocumento(leidos)
      })
      if (sesionEscaneo !== sesionEscaneoRef.current) { controles.stop(); return }
      controlesRef.current = controles
      temporizadorRef.current = setTimeout(() => {
        detenerCamara()
        setError(ERROR_LECTURA)
        setEtapa('resultado')
      }, 20000)
    } catch {
      if (sesionEscaneo !== sesionEscaneoRef.current) return
      detenerCamara()
      setError('No pudimos activar la cámara. Revisá los permisos del navegador e intentá nuevamente.')
      setEtapa('resultado')
    }
  }

  if (cargando) return <p className="campo-ayuda">Cargando verificación…</p>
  if (perfil && !['cliente', 'comisionista'].includes(perfil.rol)) {
    return <Alerta tipo="error" titulo="Acceso no disponible">Este flujo es para clientes y comisionistas.</Alerta>
  }

  const historial = solicitudes.filter((s) => s.estado !== 'EN_PROCESO')
  return (
    <section className="verif-pagina">
      {!registro && <header className="verif-encabezado">
        <p className="auth-kicker">Verificación preliminar</p>
        <h2>Comprobá tus datos de identidad</h2>
        <p>Leemos el PDF417 en este dispositivo. La solicitud conserva solo el DNI parcial y el resultado de la comparación.</p>
      </header>}

      {error && <Alerta tipo="error" titulo="No se pudo completar el paso">{error}</Alerta>}

      {etapa === 'consentimiento' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Verificá tu identidad</h3><p>Después de confirmar los datos, un administrador revisará la solicitud.</p></div><span className="verif-paso">Identidad · 1 de 2</span></div>
        <div className="verif-consentimiento">
          <h4>Privacidad y alcance</h4>
          <p>La cámara solo se activa cuando empezás el escaneo. El código se procesa en este dispositivo; no guardamos imágenes ni el DNI completo. Comparamos DNI, nombre y apellido con los datos de tu cuenta. Esta comprobación no certifica oficialmente la identidad ni la autenticidad del documento; la aprobación queda a cargo de un administrador.</p>
          <label className="check-linea"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} /><span>Leí la información y doy mi consentimiento para leer el código y registrar el resultado mínimo.</span></label>
          <div className="verif-botones"><button type="button" className="btn" onClick={onCancelarRegistro}>Continuar luego</button><button type="button" className="btn btn-primario" disabled={!consentimiento} onClick={comenzarEscaneo}>Comenzar escaneo</button></div>
        </div>
      </div>}

      {etapa === 'inicio' && !registro && <>
        {solicitudes.some((s) => s.estado === 'PENDIENTE_REVISION') && <Alerta tipo="aviso" titulo="Solicitud en revisión">Un administrador debe resolverla. No hace falta volver a escanear.</Alerta>}
        {solicitudes.some((s) => s.estado === 'APROBADA_MANUALMENTE') && <Alerta tipo="exito" titulo="Cuenta habilitada">La verificación fue aprobada por administración.</Alerta>}
        {!solicitudes.some((s) => ['PENDIENTE_REVISION', 'APROBADA_MANUALMENTE'].includes(s.estado)) && <div className="verif-card card"><div className="verif-consentimiento">
          <h3>Escaneá el código PDF417</h3>
          <p>Ubicá frente a la cámara el lado del DNI donde aparece el código. En los DNI tarjeta actuales está en el frente; en modelos anteriores puede estar en el dorso. Enfocá el código completo con buena luz y evitá reflejos.</p>
          <p>La cámara permanecerá apagada hasta que presiones el botón. Los datos se comparan con tu perfil y la aprobación requiere revisión administrativa.</p>
          <label className="check-linea"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} /><span>Leí la información y doy mi consentimiento.</span></label>
          <button type="button" className="btn btn-primario" disabled={!consentimiento} onClick={comenzarEscaneo}>Comenzar escaneo</button>
        </div></div>}
        {historial.length > 0 && <div className="verif-historial"><h3>Historial</h3>{historial.map((s) => <article className="verif-historial-item card" key={s.id}>
          <div><EstadoPill estado={s.estado} /><span className="verif-fecha">Iniciada: {formatoFecha(s.iniciada_en)}</span></div>
          {s.dni_parcial && <p>DNI registrado: <strong>{s.dni_parcial}</strong></p>}
          {s.coincidencias && <p>Comparación con el perfil: {['nombre', 'apellido', 'dni'].map((campo) => `${campo} ${s.coincidencias[campo] ? 'coincide' : 'no coincide'}`).join(' · ')}</p>}
          {s.motivo_resolucion && <div className="verif-observacion"><strong>Observación administrativa</strong><p>{s.motivo_resolucion}</p></div>}
        </article>)}</div>}
      </>}

      {etapa === 'escanear' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Enfocá el código PDF417</h3><p>Mantené el documento quieto y el código completo dentro de la imagen.</p></div><span className="verif-paso">Paso 1 de 2</span></div>
        <video ref={videoRef} className="verif-camara" autoPlay muted playsInline aria-label="Vista previa de cámara para escanear DNI" />
        {procesando && <p className="campo-ayuda" role="status">Comparando los datos con tu registro…</p>}
        <div className="verif-botones"><button type="button" className="btn" onClick={() => { detenerCamara(); setEtapa(registro ? 'consentimiento' : 'inicio'); setError('') }}>Cancelar escaneo</button>{camaraActiva && <button type="button" className="btn" onClick={() => { detenerCamara(); setEtapa('resultado'); setError(ERROR_LECTURA) }}>No se pudo leer · Reintentar</button>}</div>
      </div>}

      {etapa === 'resultado' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Resultado del escaneo</h3><p>Los datos leídos permanecen en memoria mientras estás en esta pantalla.</p></div></div>
        {datos && <><div className="verif-campos">
          <label>DNI leído<output>{enmascararDni(datos.dni)}</output></label><label>Nombre leído<output>{datos.nombre}</output></label><label>Apellido leído<output>{datos.apellido}</output></label>
        </div><h4>Comparación con tu registro</h4><ul className="verif-coincidencias">{['dni', 'nombre', 'apellido'].map((campo) => <li key={campo}><span>{campo === 'dni' ? 'DNI' : campo[0].toUpperCase() + campo.slice(1)}</span><strong className={coincidencias?.[campo] ? 'coincide' : 'discrepa'}>{coincidencias?.[campo] ? 'Coincide' : 'No coincide'}</strong></li>)}</ul></>}
        <div className="verif-botones"><button type="button" className="btn btn-primario" disabled={procesando} onClick={comenzarEscaneo}>Volver a escanear</button></div>
      </div>}

      {etapa === 'revision' && <div className="verif-card card"><Alerta tipo="exito" titulo="¡Lectura exitosa! Los datos coinciden con tu registro.">La solicitud quedó pendiente de revisión administrativa. Esta comprobación no certifica oficialmente la identidad ni la autenticidad del DNI.</Alerta><p className="verif-mensaje">No necesitás volver a escanear. Te avisaremos cuando administración resuelva la solicitud.</p></div>}
    </section>
  )
}
