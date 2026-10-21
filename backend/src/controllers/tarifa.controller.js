// Tarifa por km del comisionista (pesos ARS). La usa el sistema para calcular lo que paga
// un cliente al postularse a un viaje de ese comisionista.
import { query } from '../config/db.js'
import { PRECIO_KM_MAXIMO } from '../services/tarifa.service.js'

export async function obtener(req, res, next) {
  try {
    const { rows } = await query('SELECT precio_km FROM comisionistas WHERE usuario_id = $1', [req.usuario.id])
    res.json({ precio_km: rows[0]?.precio_km != null ? Number(rows[0].precio_km) : null })
  } catch (e) { next(e) }
}

// PUT /api/tarifa  { precio_km: 350.5 }   (null o vacio = quitar la tarifa)
export async function guardar(req, res, next) {
  try {
    const bruto = req.body?.precio_km
    let precio = null
    if (bruto !== null && bruto !== undefined && bruto !== '') {
      precio = typeof bruto === 'string' ? Number(bruto.replace(',', '.')) : Number(bruto)
      if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ mensaje: 'El precio por km debe ser un número mayor a 0' })
      }
      if (precio > PRECIO_KM_MAXIMO) {
        return res.status(400).json({ mensaje: 'El precio por km es demasiado alto' })
      }
      precio = Math.round(precio * 100) / 100
    }
    const { rows } = await query(
      `INSERT INTO comisionistas (usuario_id, precio_km) VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET precio_km = EXCLUDED.precio_km
       RETURNING precio_km`,
      [req.usuario.id, precio],
    )
    res.json({ precio_km: rows[0].precio_km != null ? Number(rows[0].precio_km) : null })
  } catch (e) { next(e) }
}
