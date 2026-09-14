// Servicio de IA (OPCIONAL - para etapas avanzadas).
// Ejemplo de esqueleto para integrar un modelo por API.
// No esta conectado a ninguna ruta todavia. Cuando lo necesiten,
// crear un controlador/ruta que llame a estas funciones.
//
// Recordar cargar la clave en backend/.env (OPENAI_API_KEY / ANTHROPIC_API_KEY)
// y NUNCA subir el .env al repositorio.

export async function sugerirOrdenParadas(paradas) {
  // TODO: llamar al modelo para optimizar el orden geografico de las paradas.
  throw new Error('IA no implementada todavia')
}
