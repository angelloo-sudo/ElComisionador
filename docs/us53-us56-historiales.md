# US53–US56: historiales

Las cuatro vistas usan endpoints de solo lectura bajo `/api/historial`. El router exige sesión JWT y rol `comisionista`; las consultas toman `req.usuario.id` y verifican la pertenencia de cada viaje en la base. No aceptan un ID de comisionista enviado por el navegador.

- **US53:** historial de todos los viajes del comisionista, orden cronológico inverso, filtros por fecha y extremos del viaje, detalle y paradas ordenadas.
- **US54:** selector limitado a clientes con solicitudes o encomiendas asociadas a viajes del comisionista. Su detalle combina solicitudes de traslado/encomienda de `solicitudes_viaje` y filas de `encomiendas`; incluye sus estados actuales y filtros por fecha/tipo.
- **US55:** incluye encomiendas de `encomiendas` y solicitudes de envío `tipo='encomienda'` ligadas a viajes del comisionista. El detalle conserva remitente/destinatario, recorrido particular cuando está almacenado y viaje principal por separado. El historial legado lee `historial_encomiendas`; el de solicitudes modernas lee `historial_solicitudes_encomienda`. Ambos presentan eventos almacenados en orden ascendente.
- **US56:** cada solicitud `tipo='pasajero'` se lista como una reserva independiente. Se muestran estado de reserva y estado operativo de pasajero, cuando existe.

## Limitaciones de persistencia

Las filas de `encomiendas` no tienen localidades particulares de retiro y entrega ni una relación con solicitudes `tipo='encomienda'`. Para ellas, el detalle separa el viaje principal y declara como no disponible el recorrido particular. Las solicitudes `tipo='encomienda'` sí almacenan las localidades propias y pueden filtrarse por ellas. No hay una relación que permita identificar si una fila de `encomiendas` representa la misma operación que una solicitud; se muestran como registros distintos y no se deduplican por heurísticas.

Los cambios de estado se registran automáticamente al insertar o cambiar el estado de cada fila. Para la nueva tabla no se reconstruyen eventos anteriores ni se rellena el historial a partir del estado actual: una base existente empieza a registrar desde que se instalan el trigger y la tabla.

### Cambio aditivo para una base existente

`backend/db/schema.sql` incorpora la tabla, el índice, la función y el trigger para instalaciones nuevas. En una base existente, no ejecutar el esquema completo. Revisar y aplicar manualmente, de forma controlada, el siguiente bloque equivalente:

```sql
CREATE TABLE IF NOT EXISTS historial_solicitudes_encomienda (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes_viaje(id) ON DELETE CASCADE,
  estado VARCHAR(12) NOT NULL CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS historial_solicitudes_encomienda_fecha_idx
  ON historial_solicitudes_encomienda (solicitud_id, fecha_hora, id);

CREATE OR REPLACE FUNCTION registrar_historial_estado_solicitud_encomienda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'encomienda' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    INSERT INTO historial_solicitudes_encomienda (solicitud_id, estado)
    VALUES (NEW.id, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solicitudes_encomienda_historial_estado ON solicitudes_viaje;
CREATE TRIGGER solicitudes_encomienda_historial_estado
AFTER INSERT OR UPDATE ON solicitudes_viaje
FOR EACH ROW EXECUTE FUNCTION registrar_historial_estado_solicitud_encomienda();
```

El bloque no elimina ni modifica filas de negocio; solo crea objetos de soporte y activa el registro de eventos futuros. No reconstruye cambios históricos anteriores.

Las pruebas de integración que escriben datos en la base no se deben ejecutar contra la base local existente.
