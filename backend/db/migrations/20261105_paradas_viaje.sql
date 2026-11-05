-- Migración aditiva: itinerario intermedio declarado por el comisionista.
-- Compatible con viajes existentes; sus extremos siguen almacenados en viajes.
BEGIN;

CREATE TABLE IF NOT EXISTS paradas_viaje (
  id             SERIAL PRIMARY KEY,
  viaje_id       INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  orden          INTEGER NOT NULL CHECK (orden > 0),
  localidad      VARCHAR(120) NOT NULL,
  hora_estimada  TIME NOT NULL,
  creado_en      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, orden),
  UNIQUE (viaje_id, localidad)
);
CREATE INDEX IF NOT EXISTS paradas_viaje_recorrido_idx ON paradas_viaje (viaje_id, orden);

COMMIT;
