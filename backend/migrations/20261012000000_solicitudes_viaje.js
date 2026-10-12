// US19: solicitudes de los clientes sobre un viaje (pasajero o encomienda).
// Es idempotente (IF NOT EXISTS): sirve tanto en una base nueva como en una que ya
// tenia la tabla creada con el schema.sql viejo.
export const up = (pgm) => {
  pgm.sql(String.raw`-- US19: solicitudes de los clientes sobre un viaje del comisionista. El cliente elige un viaje y
-- solicita viajar como PASAJERO (puede ser una familia: cantidad_pasajeros) o enviar una
-- ENCOMIENDA. Queda 'pendiente' hasta que el comisionista la acepta o la rechaza.
-- Solo las de pasajero 'aceptada' ocupan cupo (suma de cantidad_pasajeros contra viajes.cupo_total).
CREATE TABLE IF NOT EXISTS solicitudes_viaje (
  id                  SERIAL PRIMARY KEY,
  viaje_id            INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  cliente_id          INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo                VARCHAR(12) NOT NULL CHECK (tipo IN ('pasajero', 'encomienda')),
  estado              VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  -- Donde lo/la buscan (origen) y donde se baja o se entrega (destino). Comun a ambos tipos.
  origen_calle        VARCHAR(100) NOT NULL,
  origen_altura       VARCHAR(10)  NOT NULL,
  origen_barrio       VARCHAR(100) NOT NULL,
  origen_descripcion  VARCHAR(300),
  destino_calle       VARCHAR(100) NOT NULL,
  destino_altura      VARCHAR(10)  NOT NULL,
  destino_barrio      VARCHAR(100) NOT NULL,
  -- Solo tipo 'pasajero'
  nombre              VARCHAR(120),
  apellido            VARCHAR(120),
  dni                 VARCHAR(20),
  telefono            VARCHAR(40),
  lleva_equipaje      BOOLEAN,
  equipaje_detalle    VARCHAR(300),
  cantidad_pasajeros  INTEGER CHECK (cantidad_pasajeros >= 1),
  forma_pago          VARCHAR(15) CHECK (forma_pago IN ('efectivo', 'transferencia')),
  -- Solo tipo 'encomienda'
  peso_kg             NUMERIC(8,2) CHECK (peso_kg > 0),
  ancho_cm            NUMERIC(8,2) CHECK (ancho_cm > 0),
  largo_cm            NUMERIC(8,2) CHECK (largo_cm > 0),
  emisor_nombre       VARCHAR(120),
  emisor_apellido     VARCHAR(120),
  emisor_telefono     VARCHAR(40),
  receptor_nombre     VARCHAR(120),
  receptor_apellido   VARCHAR(120),
  receptor_telefono   VARCHAR(40),
  creado_en           TIMESTAMP DEFAULT NOW(),
  resuelto_en         TIMESTAMP
);
CREATE INDEX IF NOT EXISTS solicitudes_viaje_viaje_idx ON solicitudes_viaje (viaje_id, estado);
CREATE INDEX IF NOT EXISTS solicitudes_viaje_cliente_idx ON solicitudes_viaje (cliente_id);

-- US19: datos extra de las solicitudes de encomienda (es fragil / tipo de contenido).
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS fragil BOOLEAN;
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS tipo_contenido VARCHAR(30)
  CHECK (tipo_contenido IN ('electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro'));
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS contenido_descripcion VARCHAR(300);
-- US19: motivo (opcional) que escribe el comisionista al rechazar una solicitud.
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(300);
`)
}

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS solicitudes_viaje CASCADE;')
}
