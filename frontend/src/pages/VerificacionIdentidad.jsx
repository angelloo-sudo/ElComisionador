import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { Alerta, formatoFecha } from '../components/ui.jsx'
import { consolidarLecturasPDF417, detectarTipoImagenDni, esErrorPDF417SinCodigo, extraerDatosPDF417, formatearEstadoVerificacion } from '../utils/verificacion.js'
import '../styles/verificacion.css'

const ERROR_LECTURA_FOTOS = 'No encontramos un código PDF417 legible. Verificá que las fotos sean nítidas y que se vea completo el código del DNI.'
const ERROR_FOTOS_INCONSISTENTES = 'Los códigos leídos en las fotos no coinciden. Verificá que el frente y el dorso sean del mismo DNI.'
const ERROR_COINCIDENCIA = 'Los datos del DNI no coinciden con los de tu registro. Revisalos e intentá nuevamente.'
const TIPOS_IMAGEN_DNI = ['image/jpeg', 'image/png', 'image/webp']
const ACEPTA_IMAGEN_DNI = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
const TAMANO_MAXIMO_IMAGEN_DNI = 15 * 1024 * 1024
function SelectorFotosDni({ fotos, onSeleccionar, deshabilitado }) {
  const lados = [
    { cara: 'frente', titulo: 'Frente del DNI' },
    { cara: 'dorso', titulo: 'Dorso del DNI' },
  ]

  return (
    <div className="verif-documentos">
      {lados.map(({ cara, titulo }) => {
        const foto = fotos[cara]
        return (
          <article className="verif-documento" key={cara}>
            <div className="verif-documento-vista">
              {foto ? <img src={foto.vistaPrevia} alt={`Foto cargada: ${titulo}`} /> : <span>Subí una foto del {cara}</span>}
            </div>
            <div className="verif-documento-meta">
              <strong>{titulo}</strong>
              <label className="btn verif-archivo">{foto ? 'Cambiar foto' : 'Elegir foto'}
                <input type="file" accept={ACEPTA_IMAGEN_DNI} disabled={deshabilitado} onChange={(event) => onSeleccionar(cara, event)} />
              </label>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function FormularioFotosDni({ fotos, onSeleccionar, consentimiento, onConsentimientoChange, onEscanear, escaneando, procesando }) {
  const completas = Boolean(fotos.frente && fotos.dorso)
  return (
    <>
      <p>Subí una foto clara del frente y otra del dorso del mismo DNI. El código se procesa en este dispositivo; las imágenes no se envían ni se guardan en ComiTrack.</p>
      <SelectorFotosDni fotos={fotos} onSeleccionar={onSeleccionar} deshabilitado={escaneando || procesando} />
      <label className="check-linea"><input type="checkbox" checked={consentimiento} onChange={(event) => onConsentimientoChange(event.target.checked)} /><span>Leí la información y doy mi consentimiento para leer ambas fotos y registrar el resultado mínimo.</span></label>
      {!completas && <p className="campo-ayuda">Cargá las dos fotos para poder iniciar la lectura.</p>}
      {!consentimiento && <p className="campo-ayuda">Marcá la casilla de consentimiento para habilitar el escaneo.</p>}
      <div className="verif-botones">
        <button type="button" className="btn btn-primario" disabled={!completas || !consentimiento || escaneando || procesando} onClick={onEscanear}>
          {escaneando ? 'Escaneando las dos fotos…' : 'Escanear DNI'}
        </button>
      </div>
    </>
  )
}

function EstadoPill({ estado }) {
  const clase = estado === 'APROBADA_MANUALMENTE' ? 'exito' : ['RECHAZADA', 'REQUIERE_CORRECCION'].includes(estado) ? 'atencion' : 'pendiente'
  return <span className={`verif-pill ${clase}`}>{formatearEstadoVerificacion(estado)}</span>
}

export default function VerificacionIdentidad({ perfilRegistro, tokenVerificacion, onRegistroCompleto, onCancelarRegistro, onTokenInvalido }) {
  const registro = Boolean(perfilRegistro)
  const sesionEscaneoRef = useRef(0)
  const seleccionFotoRef = useRef({ frente: 0, dorso: 0 })
  const fotosRef = useRef({ frente: null, dorso: null })
  const [perfil, setPerfil] = useState(perfilRegistro || null)
  const [solicitudes, setSolicitudes] = useState([])
  const [solicitudId, setSolicitudId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [consentimiento, setConsentimiento] = useState(false)
  const [etapa, setEtapa] = useState(registro ? 'consentimiento' : 'inicio')
  const [fotos, setFotos] = useState({ frente: null, dorso: null })
  const [escaneando, setEscaneando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [coincidencias, setCoincidencias] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => () => {
    sesionEscaneoRef.current += 1
    Object.values(fotosRef.current).forEach((foto) => {
      if (foto) URL.revokeObjectURL(foto.vistaPrevia)
    })
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

  async function seleccionarFoto(cara, event) {
    const archivo = event.target.files?.[0]
    event.target.value = ''
    if (!archivo) return

    const seleccion = ++seleccionFotoRef.current[cara]
    setError('')
    if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO_IMAGEN_DNI) {
      setError(archivo.size === 0
        ? 'El archivo está vacío. Elegí otra imagen.'
        : 'La imagen supera el máximo de 15 MB. Elegí una imagen más liviana.')
      return
    }

    let tipo
    try {
      tipo = await detectarTipoImagenDni(archivo)
    } catch {
      if (seleccion === seleccionFotoRef.current[cara]) setError('No pudimos leer el archivo. Elegí otra imagen JPG, PNG o WebP.')
      return
    }
    if (seleccion !== seleccionFotoRef.current[cara]) return
    if (!TIPOS_IMAGEN_DNI.includes(tipo)) {
      setError('El archivo no parece ser una imagen JPG, PNG o WebP válida.')
      return
    }

    const anterior = fotosRef.current[cara]
    if (anterior) URL.revokeObjectURL(anterior.vistaPrevia)
    const nuevasFotos = {
      ...fotosRef.current,
      [cara]: { vistaPrevia: URL.createObjectURL(archivo) },
    }
    fotosRef.current = nuevasFotos
    setFotos(nuevasFotos)
  }

  function cancelarEscaneo() {
    sesionEscaneoRef.current += 1
    setEscaneando(false)
    setEtapa(registro ? 'consentimiento' : 'inicio')
    setError('')
  }

  async function escanearFotosDni() {
    const fotosSeleccionadas = fotosRef.current
    if (!fotosSeleccionadas.frente || !fotosSeleccionadas.dorso) {
      setError('Cargá una foto del frente y otra del dorso antes de escanear.')
      return
    }
    if (!consentimiento) return

    const sesionEscaneo = ++sesionEscaneoRef.current
    setError('')
    setDatos(null)
    setCoincidencias(null)
    setEscaneando(true)
    setEtapa('escanear')
    try {
      const { BrowserPDF417Reader } = await import('@zxing/browser')
      if (sesionEscaneo !== sesionEscaneoRef.current) return
      const lector = new BrowserPDF417Reader(new Map([[3, true]]))
      const textosLeidos = []
      for (const foto of [fotosSeleccionadas.frente, fotosSeleccionadas.dorso]) {
        if (sesionEscaneo !== sesionEscaneoRef.current) return
        try {
          const resultado = await lector.decodeFromImageUrl(foto.vistaPrevia)
          textosLeidos.push(resultado.getText())
        } catch (error) {
          if (!esErrorPDF417SinCodigo(error)) throw error
        }
      }

      if (sesionEscaneo !== sesionEscaneoRef.current) return
      const lectura = consolidarLecturasPDF417(textosLeidos)
      if (lectura.estado !== 'OK') {
        setError(lectura.estado === 'INCONSISTENTE' ? ERROR_FOTOS_INCONSISTENTES : ERROR_LECTURA_FOTOS)
        setEtapa(registro ? 'consentimiento' : 'inicio')
        return
      }
      void enviarDatosDocumento(lectura.datos)
    } catch {
      if (sesionEscaneo !== sesionEscaneoRef.current) return
      setError('No pudimos analizar las imágenes seleccionadas. Volvé a cargarlas e intentá de nuevo.')
      setEtapa(registro ? 'consentimiento' : 'inicio')
    } finally {
      if (sesionEscaneo === sesionEscaneoRef.current) setEscaneando(false)
    }
  }

  function volverACargarFotos() {
    setDatos(null)
    setCoincidencias(null)
    setError('')
    setEtapa(registro ? 'consentimiento' : 'inicio')
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
        <p>Leemos el PDF417 de las dos fotos en este dispositivo. La solicitud conserva solo el DNI parcial y el resultado de la comparación.</p>
      </header>}

      {error && <Alerta tipo="error" titulo="No se pudo completar el paso">{error}</Alerta>}

      {etapa === 'consentimiento' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Verificá tu identidad</h3><p>Después de confirmar los datos, un administrador revisará la solicitud.</p></div><span className="verif-paso">Identidad · 1 de 2</span></div>
        <div className="verif-consentimiento">
          <h4>Privacidad y alcance</h4>
          <p>Las fotos se procesan en este dispositivo y no se envían ni se guardan en ComiTrack. Comparamos el DNI, nombre y apellido leídos con los datos de tu cuenta. Esta comprobación no certifica oficialmente la identidad ni la autenticidad del documento; la aprobación queda a cargo de un administrador.</p>
          <FormularioFotosDni
            fotos={fotos}
            onSeleccionar={seleccionarFoto}
            consentimiento={consentimiento}
            onConsentimientoChange={setConsentimiento}
            onEscanear={escanearFotosDni}
            escaneando={escaneando}
            procesando={procesando}
          />
          <button type="button" className="btn" onClick={onCancelarRegistro}>Continuar luego</button>
        </div>
      </div>}

      {etapa === 'inicio' && !registro && <>
        {solicitudes.some((s) => s.estado === 'PENDIENTE_REVISION') && <Alerta tipo="aviso" titulo="Solicitud en revisión">Un administrador debe resolverla. No hace falta volver a escanear.</Alerta>}
        {solicitudes.some((s) => s.estado === 'APROBADA_MANUALMENTE') && <Alerta tipo="exito" titulo="Cuenta habilitada">La verificación fue aprobada por administración.</Alerta>}
        {!solicitudes.some((s) => ['PENDIENTE_REVISION', 'APROBADA_MANUALMENTE'].includes(s.estado)) && <div className="verif-card card"><div className="verif-consentimiento">
          <h3>Verificá las dos caras del DNI</h3>
          <p>Subí una foto clara del frente y otra del dorso del mismo DNI. El lector buscará el código PDF417 en ambas imágenes.</p>
          <p>Las fotos se procesan en este dispositivo y no se envían ni se guardan en ComiTrack. Los datos extraídos se comparan con tu perfil y la aprobación requiere revisión administrativa.</p>
          <FormularioFotosDni
            fotos={fotos}
            onSeleccionar={seleccionarFoto}
            consentimiento={consentimiento}
            onConsentimientoChange={setConsentimiento}
            onEscanear={escanearFotosDni}
            escaneando={escaneando}
            procesando={procesando}
          />
        </div></div>}
        {historial.length > 0 && <div className="verif-historial"><h3>Historial</h3>{historial.map((s) => <article className="verif-historial-item card" key={s.id}>
          <div><EstadoPill estado={s.estado} /><span className="verif-fecha">Iniciada: {formatoFecha(s.iniciada_en)}</span></div>
          {s.dni_parcial && <p>DNI registrado: <strong>{s.dni_parcial}</strong></p>}
          {s.coincidencias && <p>Comparación con el perfil: {['nombre', 'apellido', 'dni'].map((campo) => `${campo} ${s.coincidencias[campo] ? 'coincide' : 'no coincide'}`).join(' · ')}</p>}
          {s.motivo_resolucion && <div className="verif-observacion"><strong>Observación administrativa</strong><p>{s.motivo_resolucion}</p></div>}
        </article>)}</div>}
      </>}

      {etapa === 'escanear' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Leyendo frente y dorso del DNI</h3><p>Las dos imágenes se procesan localmente.</p></div><span className="verif-paso">Paso 1 de 2</span></div>
        {escaneando && <p className="campo-ayuda" role="status">Buscando el código PDF417 en ambas fotos…</p>}
        {procesando && <p className="campo-ayuda" role="status">Comparando los datos con tu registro…</p>}
        <div className="verif-botones"><button type="button" className="btn" disabled={procesando} onClick={cancelarEscaneo}>Cancelar lectura</button></div>
      </div>}

      {etapa === 'resultado' && <div className="verif-card card">
        <div className="card-cabecera"><div><h3>Resultado del escaneo</h3><p>Los datos leídos permanecen en memoria mientras estás en esta pantalla.</p></div></div>
        {datos && <><div className="verif-campos">
          <label>DNI leído<output>{datos.dni}</output></label><label>Nombre leído<output>{datos.nombre}</output></label><label>Apellido leído<output>{datos.apellido}</output></label>
        </div><h4>Comparación con tu registro</h4><ul className="verif-coincidencias">{['dni', 'nombre', 'apellido'].map((campo) => {
          const coincide = coincidencias?.[campo]
          return <li key={campo}><span>{campo === 'dni' ? 'DNI' : campo[0].toUpperCase() + campo.slice(1)}</span><strong className={coincide === true ? 'coincide' : coincide === false ? 'discrepa' : ''}>{coincide === true ? 'Coincide' : coincide === false ? 'No coincide' : 'No se pudo comparar'}</strong></li>
        })}</ul></>}
        <div className="verif-botones"><button type="button" className="btn" disabled={procesando} onClick={volverACargarFotos}>Cambiar fotos</button><button type="button" className="btn btn-primario" disabled={procesando} onClick={escanearFotosDni}>Escanear nuevamente</button></div>
      </div>}

      {etapa === 'revision' && <div className="verif-card card"><Alerta tipo="exito" titulo="¡Lectura exitosa! Los datos coinciden con tu registro.">La solicitud quedó pendiente de revisión administrativa. Esta comprobación no certifica oficialmente la identidad ni la autenticidad del DNI.</Alerta><p className="verif-mensaje">No necesitás volver a escanear. Te avisaremos cuando administración resuelva la solicitud.</p></div>}
    </section>
  )
}
