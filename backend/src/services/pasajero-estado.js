// US22 / US24 / US25 - Estado operativo del pasajero dentro de un viaje.
// Se guarda en solicitudes_viaje.estado_pasajero (NULL = todavia no subio / pendiente de subir).
export const ESTADOS_PASAJERO = ['a_bordo', 'en_destino', 'ausente', 'cancelado_comisionista']

// Transiciones validas: desde -> hacia ('pendiente' = volver a NULL, para corregir un error).
export const TRANSICIONES_PASAJERO = {
  pendiente: ['a_bordo', 'ausente', 'cancelado_comisionista'],
  a_bordo: ['en_destino', 'pendiente'],
  ausente: ['pendiente'],
  en_destino: [],
  cancelado_comisionista: [],
}

// Estados que liberan el cupo: el pasajero ausente o cancelado ya no cuenta para la ocupacion.
export const SQL_PASAJERO_ACTIVO = `COALESCE(s.estado_pasajero, '') NOT IN ('ausente', 'cancelado_comisionista')`
