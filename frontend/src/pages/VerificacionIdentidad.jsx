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

<<<<<<< HEAD
export default function VerificacionIdentidad({ perfilRegistro, tokenVerificacion, onRegistroCompleto, onCancelarRegistro, onTokenInvalido }) {
=======
function formatearFechaDocumento(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

function ResultadoOcr({ resultado }) {
  const texto = resultado === 'legible' ? 'OCR legible' : resultado === 'no_legible' ? 'OCR no legible' : 'OCR requiere revisión'
  return <span className={`verif-pill ${resultado === 'legible' ? 'exito' : 'pendiente'}`}>{texto}</span>
}

export default function VerificacionIdentidad({ perfilRegistro, onRegistroCompleto, onCancelarRegistro }) {
>>>>>>> d9bce902fc2f6a45d720ceea574b9a3f97557beb
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

  function detenerCamara() {
    sesionEscaneoRef.current += 1
    clearTimeout(temporizadorRef.current)
    temporizadorRef.current = null
    controlesRef.current?.stop()
    controlesRef.current = null
    lectorRef.current?.reset()
    setCamaraActiva(false)
  }

  useEffect(() => () => {
    sesionEscaneoRef.current += 1
    controlesRef.current?.stop()
    lectorRef.current?.reset()
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
<<<<<<< HEAD
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
=======
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('spa', 1, {
        workerPath: '/vendor/tesseract/worker.min.js',
        corePath: '/vendor/tesseract',
        langPath: '/vendor/tesseract',
        gzip: true,
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === 'recognizing text') setProgreso(`Leyendo documento: ${Math.round(m.progress * 100)}%`)
        },
      })
      const frente = await worker.recognize(imagenes.frente)
      setProgreso('Leyendo el dorso del documento…')
      const dorso = await worker.recognize(imagenes.dorso)
      const extraidos = extraerDatosDni([frente.data.text, dorso.data.text])
      setDatos(extraidos)
      setEtapa('datos')
    } catch {
      setError('No se pudo leer el documento con el motor local. Revisá las imágenes o completá los datos manualmente.')
      setDatos((actual) => ({ ...actual, resultado_ocr: 'no_legible' }))
      setEtapa('datos')
    } finally {
      await worker?.terminate().catch(() => {})
      setProgreso('')
      setProcesando(false)
    }
  }

  function actualizarDato(event) {
    const { name, value } = event.target
    const actualizado = ['fecha_nacimiento', 'fecha_vencimiento'].includes(name) ? formatearFechaDocumento(value) : value
    setDatos((actual) => ({ ...actual, [name]: actualizado }))
  }

  function continuarSelfie() {
    const dni = String(datos.dni || '').replace(/\D/g, '')
    if (datos.resultado_ocr !== 'legible' || !/^\d{7,8}$/.test(dni) || !datos.nombre.trim() || !datos.apellido.trim()) {
      setError('El OCR debe poder leer el DNI, el nombre y el apellido. Revisá las imágenes y repetí el análisis si no se identificaron los datos necesarios.')
      return
    }
    setDatos((actual) => ({ ...actual, dni }))
    setError('')
    setEtapa('selfie')
  }

  async function enviar() {
    const dniParcial = enmascararDni(datos.dni)
    if (!dniParcial || !controles) {
      setError('Completá los datos del DNI y la comprobación facial antes de enviar.')
      return
    }
    setError('')
    setProcesando(true)
    try {
      if (registro) {
        await onRegistroCompleto({ consentimiento: true, dni_parcial: dniParcial, resultado_ocr: datos.resultado_ocr, coincidencias: diferencias, controles_faciales: controles })
        setImagenes({ frente: null, dorso: null })
        setDatos(DATOS_VACIOS)
        setControles(null)
        setSelfie(null)
>>>>>>> d9bce902fc2f6a45d720ceea574b9a3f97557beb
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
      const lector = new BrowserPDF417Reader()
      lectorRef.current = lector
      const controles = await lector.decodeFromVideoDevice(undefined, videoRef.current, (resultado) => {
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

<<<<<<< HEAD
      {etapa === 'revision' && <div className="verif-card card"><Alerta tipo="exito" titulo="¡Lectura exitosa! Los datos coinciden con tu registro.">La solicitud quedó pendiente de revisión administrativa. Esta comprobación no certifica oficialmente la identidad ni la autenticidad del DNI.</Alerta><p className="verif-mensaje">No necesitás volver a escanear. Te avisaremos cuando administración resuelva la solicitud.</p></div>}
=======
      {etapa === 'datos' && (
        <div className="verif-card card">
          <div className="card-cabecera"><div><h3>Revisá la lectura OCR</h3><p>El reconocimiento puede equivocarse. Corregí lo que sea necesario.</p></div><ResultadoOcr resultado={datos.resultado_ocr} /></div>
          <div className="verif-aviso-privado">Estos datos solo permanecen en la memoria de esta pantalla. El número completo del DNI no se envía al servidor.</div>
          <div className="verif-campos">
            <label>DNI leído o corregido<input name="dni" inputMode="numeric" autoComplete="off" value={datos.dni} onChange={actualizarDato} placeholder="7 u 8 dígitos" maxLength={12} /></label>
            <label>Nombre<input name="nombre" autoComplete="off" value={datos.nombre} onChange={actualizarDato} maxLength={120} /></label>
            <label>Apellido<input name="apellido" autoComplete="off" value={datos.apellido} onChange={actualizarDato} maxLength={120} /></label>
            <label>Fecha de nacimiento<input name="fecha_nacimiento" inputMode="numeric" maxLength={10} value={datos.fecha_nacimiento} onChange={actualizarDato} placeholder="DD/MM/AAAA" /></label>
            <label>Vencimiento (si se leyó)<input name="fecha_vencimiento" inputMode="numeric" maxLength={10} value={datos.fecha_vencimiento} onChange={actualizarDato} placeholder="DD/MM/AAAA" /></label>
            <label>Número de trámite (si se leyó)<input name="numero_tramite" inputMode="numeric" autoComplete="off" value={datos.numero_tramite} onChange={actualizarDato} /></label>
          </div>
          <h4>Comparación con el perfil</h4>
          <ul className="verif-coincidencias">
            {['nombre', 'apellido', 'dni'].map((campo) => <li key={campo}><span>{campo === 'dni' ? 'DNI' : campo[0].toUpperCase() + campo.slice(1)}</span><strong className={diferencias[campo] === true ? 'coincide' : diferencias[campo] === false ? 'discrepa' : ''}>{diferencias[campo] === null ? 'Sin dato para comparar' : diferencias[campo] ? 'Coincide' : 'Hay una diferencia'}</strong></li>)}
          </ul>
          <p className="campo-ayuda">Las diferencias se informan al administrador. El perfil no se modifica automáticamente.</p>
          <div className="verif-botones"><button type="button" className="btn" onClick={() => setEtapa('dni')}>Volver a las imágenes</button><button type="button" className="btn btn-primario" onClick={continuarSelfie}>Continuar a la comprobación facial</button></div>
        </div>
      )}

      {etapa === 'selfie' && (
        <div className="verif-card card">
          <div className="card-cabecera"><div><h3>Comprobación facial guiada</h3><p>La cámara se usa en vivo. Al completar el desafío se captura una vista previa temporal para que la revises antes del envío.</p></div><span className="verif-paso">Paso 2 de 3</span></div>
          <Alerta tipo="aviso" titulo="Alcance de esta comprobación">Detectar estos movimientos no confirma la identidad de la persona y no constituye una prueba de vida robusta.</Alerta>
          <DesafioFacial onCompleto={(resultado, captura) => { setControles(resultado); setSelfie(captura); setEtapa('resumen') }} />
          <div className="verif-botones"><button type="button" className="btn" onClick={() => { setError(''); setControles(null); setSelfie(null); setEtapa('datos') }}>Volver</button></div>
        </div>
      )}

      {etapa === 'resumen' && (
        <div className="verif-card card">
          <div className="card-cabecera"><div><h3>Resumen antes de enviar</h3><p>La aprobación requiere revisión de una persona administradora.</p></div><span className="verif-paso">Paso 3 de 3</span></div>
          <dl className="verif-resumen">
            {selfiePreview && <div className="verif-selfie-resumen"><dt>Selfie capturada (solo vista previa)</dt><dd><img src={selfiePreview} alt="Selfie temporal para revisar antes del envío" /></dd></div>}
            <div><dt>DNI</dt><dd>{enmascararDni(datos.dni)}</dd></div>
            <div><dt>Nombre</dt><dd>{datos.nombre || 'No reconocido'}</dd></div>
            <div><dt>Apellido</dt><dd>{datos.apellido || 'No reconocido'}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{datos.fecha_nacimiento || 'No identificada'}</dd></div>
            <div><dt>Vencimiento</dt><dd>{datos.fecha_vencimiento || 'No identificado'}</dd></div>
            <div><dt>Número de trámite</dt><dd>{datos.numero_tramite ? 'Identificado; no se envía ni conserva' : 'No identificado'}</dd></div>
            <div><dt>Resultado OCR</dt><dd>{datos.resultado_ocr}</dd></div>
            <div><dt>Coincidencias</dt><dd>{Object.entries(diferencias).map(([k, v]) => `${k}: ${v === null ? 'sin dato' : v ? 'coincide' : 'diferencia'}`).join(' · ')}</dd></div>
            <div><dt>Comprobación facial</dt><dd>{controles?.rostro_unico && controles?.parpadeo && controles?.giro && controles?.frente ? 'Un rostro, parpadeo, giro y regreso al frente detectados' : 'Incompleta'}</dd></div>
          </dl>
          <Alerta tipo="aviso" titulo="Verificación preliminar">No se envían las imágenes, la selfie ni el DNI completo. La aceptación de estos controles no certifica la autenticidad del documento ni la identidad.</Alerta>
          {procesando && <p className="campo-ayuda">Enviando resultados…</p>}
          <div className="verif-botones"><button type="button" className="btn" onClick={() => { setControles(null); setSelfie(null); setEtapa('selfie') }} disabled={procesando}>Repetir comprobación facial</button><button type="button" className="btn btn-primario" onClick={enviar} disabled={procesando}>{procesando ? 'Enviando…' : 'Enviar a revisión'}</button></div>
        </div>
      )}
>>>>>>> d9bce902fc2f6a45d720ceea574b9a3f97557beb
    </section>
  )
}
