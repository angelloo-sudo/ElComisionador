import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, guardarContinuacionVerificacion, leerContinuacionVerificacion, limpiarContinuacionVerificacion } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Logo } from '../components/ui.jsx'
import VerificacionIdentidad from './VerificacionIdentidad.jsx'

export default function VerificarEmail() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const token = parametros.get('token')
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [continuacion, setContinuacion] = useState(() => leerContinuacionVerificacion())
  const [completada, setCompletada] = useState(false)
  const [reenvio, setReenvio] = useState('')

  function salirA(ruta) {
    limpiarContinuacionVerificacion()
    setContinuacion(null)
    navegar(ruta)
  }

  useEffect(() => {
    if (!token) { setCargando(false); return }
    api.post('/auth/verificar-email', { token })
      .then((respuesta) => {
        // El cliente no verifica identidad: con el correo confirmado ya puede iniciar sesión.
        if (!respuesta.tokenVerificacion) {
          limpiarContinuacionVerificacion()
          setContinuacion(null)
          setMensaje(respuesta.mensaje)
          return
        }
        const siguiente = { ...leerContinuacionVerificacion(), token: respuesta.tokenVerificacion, rol: respuesta.rol, email: respuesta.email }
        guardarContinuacionVerificacion(siguiente)
        setContinuacion(siguiente)
        setMensaje(respuesta.mensaje)
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [token])

  if (continuacion?.token && !completada) return <main className="auth-pagina"><div className="auth-card" style={{ maxWidth: 760 }}><Logo /><VerificacionIdentidad perfilRegistro={{ rol: continuacion.rol }} tokenVerificacion={continuacion.token} onRegistroCompleto={() => { limpiarContinuacionVerificacion(); setContinuacion(null); setCompletada(true) }} onCancelarRegistro={() => setCompletada(true)} onTokenInvalido={() => { const sinToken = { email: continuacion.email, rol: continuacion.rol }; guardarContinuacionVerificacion(sinToken); setContinuacion(sinToken); setCompletada(true) }} /></div></main>
  return (
    <main className="auth-pagina">
      <div className="auth-card auth-centro">
        <Logo />
        <span className={`icono-caja ${error ? 'rojo' : ''}`}>
          <Icon nombre={cargando ? 'mail' : error ? 'alert' : 'checkcircle'} tamano={26} />
        </span>
        <h1>{cargando ? 'Verificando correo...' : error ? 'No se pudo verificar' : completada ? 'Solicitud enviada a revisión' : token ? 'Correo verificado' : 'Continuá tu registro'}</h1>
        <p>{cargando ? 'Estamos comprobando el enlace.' : error || mensaje}</p>
        {continuacion?.email && !continuacion?.token && <button className="btn btn-primario" onClick={async () => { try { const r = await api.post('/auth/reenviar-verificacion', { email: continuacion.email }); setReenvio(r.mensaje) } catch (e) { setReenvio(e.message) } }}>{reenvio || 'Reenviar enlace para continuar'}</button>}
        <div className="verif-botones" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => salirA('/ingresar')}>Volver a iniciar sesión</button>
          <button type="button" className="btn" onClick={() => salirA('/')}>Volver al inicio</button>
        </div>
        {!token && !continuacion && !completada && !cargando && <p>Usá el enlace que recibiste por correo para continuar.</p>}
        {completada && <p>Podés retomar la verificación desde este dispositivo cuando quieras.</p>}
      </div>
    </main>
  )
}
