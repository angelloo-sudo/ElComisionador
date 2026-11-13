// Cliente HTTP central. Usa el proxy de Vite (/api -> backend).
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const CLAVE_CONTINUACION = 'comitrack_verificacion_pendiente'

export function guardarContinuacionVerificacion(datos) { localStorage.setItem(CLAVE_CONTINUACION, JSON.stringify(datos)) }
export function leerContinuacionVerificacion() { try { return JSON.parse(localStorage.getItem(CLAVE_CONTINUACION) ?? 'null') } catch { return null } }
export function limpiarContinuacionVerificacion() { localStorage.removeItem(CLAVE_CONTINUACION) }

async function request(path, options = {}) {
  const { token: tokenTemporal, ...fetchOptions } = options
  const token = tokenTemporal ?? localStorage.getItem('comitrack_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const texto = await res.text()
    // El backend responde JSON con { mensaje } o { errores: [...] }. Si se puede
    // parsear, mostramos el mensaje limpio; si no, el texto crudo como antes.
    try {
      const cuerpo = JSON.parse(texto)
      const mensaje = cuerpo.mensaje ?? (Array.isArray(cuerpo.errores) ? cuerpo.errores.join(' | ') : null)
      const error = new Error(mensaje || texto || `Error ${res.status}`)
      error.status = res.status
      error.codigo = cuerpo.codigo
      error.respuesta = cuerpo
      error.retryAfterSeconds = cuerpo.retryAfterSeconds
      throw error
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(texto || `Error ${res.status}`)
      }
      throw e
    }
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options = {}) => request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (path, body, options = {}) => request(path, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (path, body, options = {}) => request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  del: (path, options) => request(path, { method: 'DELETE', ...options }),
}

export function guardarSesion({ token, usuario }) {
  // La foto y la presentacion pueden pesar bastante: no se guardan en localStorage
  // (la sesion solo necesita rol, nombre, etc.). Se piden a /auth/perfil cuando hacen falta.
  const { foto_perfil, presentacion, ...usuarioLiviano } = usuario
  localStorage.setItem('comitrack_token', token)
  localStorage.setItem('comitrack_usuario', JSON.stringify(usuarioLiviano))
}

export function cerrarSesion() {
  localStorage.removeItem('comitrack_token')
  localStorage.removeItem('comitrack_usuario')
}
