// Ayudas de formato del Resumen. Las fechas llegan como "AAAA-MM-DD" (texto) y no se pasan por Date
// con zona horaria para que no se corran de dia.
import { hoyEnCordoba } from '../../utils/estadoViaje.js'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const aUtc = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d) }

export const fechaCorta = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${a}` }
export const hora = (h) => (h ? String(h).slice(0, 5) : null)

// "Hoy · 08:00", "Mañana · 08:00", "jue 22/10 · 08:00"
export function cuando(fecha, horaSalida) {
  if (!fecha) return '—'
  const dias = Math.round((aUtc(fecha) - aUtc(hoyEnCordoba())) / 86400000)
  const h = hora(horaSalida)
  let dia
  if (dias === 0) dia = 'Hoy'
  else if (dias === 1) dia = 'Mañana'
  else {
    const f = String(fecha).slice(0, 10).split('-')
    dia = `${DIAS[new Date(aUtc(fecha)).getUTCDay()]} ${f[2]}/${f[1]}`
  }
  return h ? `${dia} · ${h}` : dia
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
