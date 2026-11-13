import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, formatoFecha } from '../components/ui.jsx'
import DesafioFacial from '../components/verificacion/DesafioFacial.jsx'
import {
  compararPerfil, enmascararDni, extraerDatosDni, formatearEstadoVerificacion,
} from '../utils/verificacion.js'
import '../styles/verificacion.css'

const DATOS_VACIOS = {
  dni: '', nombre: '', apellido: '', fecha_nacimiento: '', fecha_vencimiento: '', numero_tramite: '', resultado_ocr: 'no_legible',
}

function ImagenDocumento({ titulo, archivo, onChange, onInvalid }) {
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!archivo) { setPreview(''); return undefined }
    const url = URL.createObjectURL(archivo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  return (
    <div className="verif-documento">
      <div className="verif-documento-vista">
        {preview ? <img src={preview} alt={`Vista previa del ${titulo.toLowerCase()} del DNI`} /> : <span>Sin imagen</span>}
      </div>
      <div className="verif-documento-meta">
        <strong>{titulo}</strong>
        <label className="btn verif-archivo">
          {archivo ? 'Cambiar imagen' : 'Elegir o capturar'}
          <input type="file" accept="image/*" capture="environment" onChange={(e) => {
            const file = e.target.files?.[0] || null
            if (file && (!file.type.startsWith('image/') || file.size === 0 || file.size > 15 * 1024 * 1024)) {
              onChange(null)
              onInvalid('Elegí una imagen válida de hasta 15 MB para cada lado del DNI.')
            } else {
              onInvalid('')
              onChange(file)
            }
            e.target.value = ''
          }} />
        </label>
        {archivo && <button type="button" className="verif-link" onClick={() => onChange(null)}>Quitar</button>}
      </div>
    </div>
  )
}

function EstadoPill({ estado }) {
  const clase = estado === 'APROBADA_MANUALMENTE' ? 'exito' : ['RECHAZADA', 'REQUIERE_CORRECCION'].includes(estado) ? 'atencion' : 'pendiente'
  return <span className={`verif-pill ${clase}`}>{formatearEstadoVerificacion(estado)}</span>
}

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
  const registro = Boolean(perfilRegistro)
  const [perfil, setPerfil] = useState(perfilRegistro || null)
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(!registro)
  const [consentimiento, setConsentimiento] = useState(false)
  const [solicitudId, setSolicitudId] = useState(null)
  const [etapa, setEtapa] = useState(registro ? 'consentimiento' : 'inicio')
  const [imagenes, setImagenes] = useState({ frente: null, dorso: null })
  const [datos, setDatos] = useState(DATOS_VACIOS)
  const [controles, setControles] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [enviada, setEnviada] = useState(false)

  async function cargar() {
    setError('')
    try {
      const [cuenta, historial] = await Promise.all([api.get('/auth/perfil'), api.get('/verificaciones/mias')])
      setPerfil(cuenta)
      setSolicitudes(historial)
    } catch (e) { setError(e.message || 'No se pudo consultar el estado de la verificación.') }
    finally { setCargando(false) }
  }

  useEffect(() => { if (!registro) cargar() }, [registro])

  useEffect(() => {
    if (!selfie) { setSelfiePreview(''); return undefined }
    const url = URL.createObjectURL(selfie)
    setSelfiePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selfie])

  const activa = useMemo(() => solicitudes.find((s) => s.estado === 'EN_PROCESO' || s.estado === 'PENDIENTE_REVISION'), [solicitudes])
  const ultima = solicitudes[0]
  const diferencias = compararPerfil(datos, perfil)

  async function iniciar() {
    setError('')
    if (registro) {
      setEtapa('dni')
      setDatos(DATOS_VACIOS)
      setImagenes({ frente: null, dorso: null })
      setControles(null)
      setSelfie(null)
      return
    }
    try {
      const nueva = await api.post('/verificaciones', { consentimiento: true })
      setSolicitudId(nueva.id)
      setEtapa('dni')
      setEnviada(false)
      setDatos(DATOS_VACIOS)
      setImagenes({ frente: null, dorso: null })
      setControles(null)
      setSelfie(null)
    } catch (e) {
      setError(e.message || 'No se pudo iniciar la solicitud.')
      await cargar()
    }
  }

  function retomar() {
    setSolicitudId(activa.id)
    setDatos(DATOS_VACIOS)
    setImagenes({ frente: null, dorso: null })
    setControles(null)
    setSelfie(null)
    setEnviada(false)
    setError('')
    setEtapa('dni')
  }

  async function analizarDni() {
    if (!imagenes.frente || !imagenes.dorso) {
      setError('Cargá una imagen del frente y otra del dorso del DNI.')
      return
    }
    setProcesando(true)
    setError('')
    setProgreso('Preparando el motor OCR local…')
    let worker
    try {
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
        return
      }
      await api.patch(`/verificaciones/${solicitudId}/enviar`, {
        dni_parcial: dniParcial,
        resultado_ocr: datos.resultado_ocr,
        coincidencias: diferencias,
        controles_faciales: controles,
      })
      setEnviada(true)
      setEtapa('inicio')
      setImagenes({ frente: null, dorso: null })
      setDatos(DATOS_VACIOS)
      setControles(null)
      setSelfie(null)
      await cargar()
    } catch (e) { setError(e.message || 'No se pudo enviar la solicitud.') }
    finally { setProcesando(false) }
  }

  function volverInicio() {
    if (registro) {
      setEtapa('consentimiento')
      setError('')
      setImagenes({ frente: null, dorso: null })
      setControles(null)
      setSelfie(null)
      return
    }
    setEtapa('inicio')
    setError('')
    setImagenes({ frente: null, dorso: null })
    setControles(null)
    setSelfie(null)
  }

  if (cargando) return <p className="campo-ayuda">Cargando verificación…</p>
  if (perfil && !['cliente', 'comisionista'].includes(perfil.rol)) {
    return <Alerta tipo="error" titulo="Acceso no disponible">Este flujo es para clientes y comisionistas.</Alerta>
  }

  return (
    <section className="verif-pagina">
      {!registro && <header className="verif-encabezado">
        <p className="auth-kicker">Verificación preliminar</p>
        <h2>Comprobá tus datos de identidad</h2>
        <p>Las imágenes se analizan en este dispositivo. La solicitud guarda solo resultados mínimos para revisión administrativa.</p>
      </header>}

      {error && <Alerta tipo="error" titulo="No se pudo completar el paso">{error}</Alerta>}

      {etapa === 'consentimiento' && (
        <div className="verif-card card">
          <div className="card-cabecera"><div><h3>Verificá tu identidad para crear la cuenta</h3><p>Este paso forma parte del registro; todavía no se creó ninguna cuenta.</p></div><span className="verif-paso">Identidad · 1 de 3</span></div>
          <div className="verif-consentimiento">
            <h4>Privacidad y revisión</h4>
            <p>El frente y dorso del DNI se analizan localmente con OCR. La cámara se usa para los controles faciales y la vista previa se elimina al terminar. No se envían ni guardan imágenes, selfie, DNI completo ni puntos faciales. Solo se enviarán el DNI parcialmente oculto y los resultados de lectura, comparación y controles para revisión administrativa. Los controles son preliminares y no certifican oficialmente tu identidad.</p>
            <label className="check-linea"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} /><span>Leí la información y doy mi consentimiento para procesar estos datos localmente y registrar los resultados mínimos.</span></label>
            <div className="verif-botones"><button type="button" className="btn" onClick={onCancelarRegistro}>Cancelar registro</button><button type="button" className="btn btn-primario" disabled={!consentimiento} onClick={iniciar}>Continuar</button></div>
          </div>
        </div>
      )}

      {etapa === 'inicio' && !registro && (
        <>
          {enviada && <Alerta tipo="exito" titulo="Solicitud registrada">Quedó pendiente de revisión administrativa. Podés consultar su estado en esta pantalla.</Alerta>}
          <div className="verif-card card">
            <div className="card-cabecera"><div><h3>Estado actual</h3><p>El estado se recupera de tu cuenta cada vez que abrís esta pantalla.</p></div><EstadoPill estado={ultima?.estado || 'NO_INICIADA'} /></div>
            {activa?.estado === 'PENDIENTE_REVISION' && <p className="verif-mensaje">Tu solicitud está en revisión. No necesitás volver a enviar documentos.</p>}
            {activa?.estado === 'EN_PROCESO' && <div className="verif-acciones"><p>Hay una solicitud en proceso. Podés retomarla; las imágenes anteriores no se guardaron y tendrás que capturarlas de nuevo.</p><button type="button" className="btn btn-primario" onClick={retomar}>Retomar verificación</button></div>}
            {!activa && (
              <div className="verif-consentimiento">
                <h4>Antes de empezar</h4>
                <p>Vas a fotografiar el frente y el dorso de tu DNI y realizar una comprobación breve con la cámara frontal, que toma una vista previa temporal al terminar. El OCR y el análisis de movimientos se ejecutan localmente en el navegador. Las imágenes, la vista previa de la selfie, el DNI completo y los puntos faciales no se envían al servidor ni se guardan en almacenamiento del navegador; permanecen en memoria mientras completás la pantalla.</p>
                <p>ComiTrack guardará el DNI parcialmente oculto, resultados generales de OCR y coincidencias, y si se detectaron rostro único, parpadeo, giro y mirada al frente. MediaPipe también puede enviar a Google métricas técnicas de uso y rendimiento; no envía las imágenes ni los resultados del análisis. Un administrador revisará la solicitud. Esto es un control preliminar, no valida oficialmente la identidad ni la autenticidad del documento.</p>
                <label className="check-linea"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} /><span>Leí la información y doy mi consentimiento para procesar estos datos localmente y registrar los resultados mínimos.</span></label>
                <button type="button" className="btn btn-primario" disabled={!consentimiento} onClick={iniciar}>Comenzar verificación</button>
              </div>
            )}
          </div>

          <div className="verif-historial">
            <h3>Historial</h3>
            {solicitudes.length === 0 && <p className="campo-ayuda">Todavía no tenés solicitudes.</p>}
            {solicitudes.map((s) => (
              <article className="verif-historial-item card" key={s.id}>
                <div><EstadoPill estado={s.estado} /><span className="verif-fecha">Iniciada: {formatoFecha(s.iniciada_en)}</span></div>
                {s.enviada_en && <p>Enviada: {formatoFecha(s.enviada_en)}</p>}
                {s.resuelta_en && <p>Resuelta: {formatoFecha(s.resuelta_en)}</p>}
                {s.dni_parcial && <p>DNI registrado: <strong>{s.dni_parcial}</strong></p>}
                {s.resultado_ocr && <p>Lectura del documento: {s.resultado_ocr === 'legible' ? 'legible' : s.resultado_ocr === 'no_legible' ? 'no legible' : 'requiere revisión'}</p>}
                {s.coincidencias && <p>Comparación con el perfil: {['nombre', 'apellido', 'dni'].map((campo) => `${campo} ${s.coincidencias[campo] === null ? 'sin dato' : s.coincidencias[campo] ? 'coincide' : 'difiere'}`).join(' · ')}</p>}
                {s.controles_faciales && <p>Comprobación facial: {[["rostro_unico", 'rostro'], ['parpadeo', 'parpadeo'], ['giro', 'giro'], ['frente', 'regreso al frente']].map(([campo, titulo]) => `${titulo}: ${s.controles_faciales[campo] ? 'detectado' : 'no detectado'}`).join(' · ')}</p>}
                {s.motivo_resolucion && <div className="verif-observacion"><strong>Observación administrativa</strong><p>{s.motivo_resolucion}</p></div>}
                {s.estado === 'REQUIERE_CORRECCION' && <p>Podés iniciar una nueva solicitud para corregir la información o repetir los pasos.</p>}
              </article>
            ))}
          </div>
        </>
      )}

      {etapa === 'dni' && (
        <div className="verif-card card">
          <div className="card-cabecera"><div><h3>Fotografiá el DNI</h3><p>Seleccioná una imagen del frente y otra del dorso.</p></div><span className="verif-paso">Paso 1 de 3</span></div>
          <Alerta tipo="aviso" titulo="Para una lectura más clara">Usá buena iluminación, mantené el documento completo dentro del encuadre, evitá reflejos y verificá que esté enfocado.</Alerta>
          <div className="verif-documentos">
            <ImagenDocumento titulo="Frente del DNI" archivo={imagenes.frente} onChange={(frente) => setImagenes((a) => ({ ...a, frente }))} onInvalid={setError} />
            <ImagenDocumento titulo="Dorso del DNI" archivo={imagenes.dorso} onChange={(dorso) => setImagenes((a) => ({ ...a, dorso }))} onInvalid={setError} />
          </div>
          {procesando && <p className="campo-ayuda" role="status">{progreso}</p>}
          <div className="verif-botones"><button type="button" className="btn" onClick={volverInicio} disabled={procesando}>Cancelar</button><button type="button" className="btn btn-primario" disabled={procesando || !imagenes.frente || !imagenes.dorso} onClick={analizarDni}>{procesando ? 'Procesando…' : 'Analizar ambas imágenes en este dispositivo'}</button></div>
        </div>
      )}

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
    </section>
  )
}
