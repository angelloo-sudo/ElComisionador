// Tarifa por km del comisionista (pesos ARS). La usa el sistema para calcular lo que paga
// un cliente al postularse a un viaje de ese comisionista.
import { query } from '../config/db.js'
import { PRECIO_KM_MAXIMO } from '../services/tarifa.service.js'

const TAMANOS_ENCOMIENDA = ['chica', 'mediana', 'grande']
const MONTO_MINIMO_MAXIMO = 9_999_999_999.99

export async function obtener(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT precio_km, monto_minimo_encomienda_chica, monto_minimo_encomienda_mediana, monto_minimo_encomienda_grande
       FROM comisionistas WHERE usuario_id = $1`,
      [req.usuario.id],
    )
    const tarifa = rows[0]
    res.json({
      precio_km: tarifa?.precio_km != null ? Number(tarifa.precio_km) : null,
      minimos_encomienda: Object.fromEntries(TAMANOS_ENCOMIENDA.map((tamano) => {
        const monto = tarifa?.[`monto_minimo_encomienda_${tamano}`]
        return [tamano, monto != null ? Number(monto) : null]
      })),
    })
  } catch (e) { next(e) }
}

// GET returns minima keyed by chica/mediana/grande. PUT updates either setting;
// omitted fields stay unchanged, while null clears a configured amount.
export async function guardar(req, res, next) {
  try {
    const precioIncluido = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'precio_km')
    const minimosIncluidos = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'minimos_encomienda')
    if (!precioIncluido && !minimosIncluidos) {
      return res.status(400).json({ mensaje: 'Indicá el precio por km o los montos mínimos de encomienda' })
    }

    const bruto = req.body?.precio_km
    let precio = null
    if (precioIncluido && bruto !== null && bruto !== undefined && bruto !== '') {
      precio = typeof bruto === 'string' ? Number(bruto.replace(',', '.')) : Number(bruto)
      if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ mensaje: 'El precio por km debe ser un número mayor a 0' })
      }
      if (precio > PRECIO_KM_MAXIMO) {
        return res.status(400).json({ mensaje: 'El precio por km es demasiado alto' })
      }
      precio = Math.round(precio * 100) / 100
    }

    let minimos = null
    if (minimosIncluidos) {
      const datos = req.body.minimos_encomienda
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)
          || TAMANOS_ENCOMIENDA.some((tamano) => !Object.prototype.hasOwnProperty.call(datos, tamano))) {
        return res.status(400).json({ mensaje: 'Indicá un monto mínimo para cada tamaño: chica, mediana y grande' })
      }
      minimos = {}
      for (const tamano of TAMANOS_ENCOMIENDA) {
        const brutoMonto = datos[tamano]
        if (brutoMonto == null || brutoMonto === '') {
          minimos[tamano] = null
          continue
        }
        const monto = typeof brutoMonto === 'string' ? Number(brutoMonto.replace(',', '.')) : Number(brutoMonto)
        if (!Number.isFinite(monto) || monto < 0 || monto > MONTO_MINIMO_MAXIMO) {
          return res.status(400).json({ mensaje: `El monto mínimo para encomienda ${tamano} debe ser un número entre 0 y ${MONTO_MINIMO_MAXIMO}` })
        }
        minimos[tamano] = Math.round(monto * 100) / 100
      }
    }

    const { rows } = await query(
      `INSERT INTO comisionistas (
         usuario_id, precio_km, monto_minimo_encomienda_chica,
         monto_minimo_encomienda_mediana, monto_minimo_encomienda_grande
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id) DO UPDATE SET
         precio_km = CASE WHEN $6 THEN EXCLUDED.precio_km ELSE comisionistas.precio_km END,
         monto_minimo_encomienda_chica = CASE WHEN $7 THEN EXCLUDED.monto_minimo_encomienda_chica ELSE comisionistas.monto_minimo_encomienda_chica END,
         monto_minimo_encomienda_mediana = CASE WHEN $7 THEN EXCLUDED.monto_minimo_encomienda_mediana ELSE comisionistas.monto_minimo_encomienda_mediana END,
         monto_minimo_encomienda_grande = CASE WHEN $7 THEN EXCLUDED.monto_minimo_encomienda_grande ELSE comisionistas.monto_minimo_encomienda_grande END
       RETURNING precio_km, monto_minimo_encomienda_chica, monto_minimo_encomienda_mediana, monto_minimo_encomienda_grande`,
      [
        req.usuario.id, precio, minimos?.chica ?? null, minimos?.mediana ?? null, minimos?.grande ?? null,
        precioIncluido, minimosIncluidos,
      ],
    )
    const tarifa = rows[0]
    res.json({
      precio_km: tarifa.precio_km != null ? Number(tarifa.precio_km) : null,
      minimos_encomienda: Object.fromEntries(TAMANOS_ENCOMIENDA.map((tamano) => {
        const monto = tarifa[`monto_minimo_encomienda_${tamano}`]
        return [tamano, monto != null ? Number(monto) : null]
      })),
    })
  } catch (e) { next(e) }
}
