// Cliente HTTP central. Usa el proxy de Vite (/api -> backend).
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('comitrack_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Error ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export function guardarSesion({ token, usuario }) {
  localStorage.setItem('comitrack_token', token)
  localStorage.setItem('comitrack_usuario', JSON.stringify(usuario))
}

export function cerrarSesion() {
  localStorage.removeItem('comitrack_token')
  localStorage.removeItem('comitrack_usuario')
}
