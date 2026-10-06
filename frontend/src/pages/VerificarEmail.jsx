import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Logo } from '../components/ui.jsx'

export default function VerificarEmail() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const token = parametros.get('token')
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('El enlace no contiene un token de verificación.')
      setCargando(false)
      return
    }

    api.post('/auth/verificar-email', { token })
      .then((respuesta) => setMensaje(respuesta.mensaje))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [token])

  return (
    <main className="auth-pagina">
      <div className="auth-card auth-centro">
        <Logo />
        <span className={`icono-caja ${error ? 'rojo' : ''}`}>
          <Icon nombre={cargando ? 'mail' : error ? 'alert' : 'checkcircle'} tamano={26} />
        </span>
        <h1>{cargando ? 'Verificando correo...' : error ? 'No se pudo verificar' : 'Correo verificado'}</h1>
        <p>{cargando ? 'Estamos comprobando el enlace.' : error || mensaje}</p>
        {!cargando && (
          <button type="button" className="btn btn-primario btn-bloque" onClick={() => navegar('/')}>
            Ir a iniciar sesión <Icon nombre="arrow" />
          </button>
        )}
      </div>
    </main>
  )
}