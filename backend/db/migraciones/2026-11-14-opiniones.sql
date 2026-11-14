-- Agrega la tabla de opiniones de la comunidad (no modifica datos existentes).
-- psql -d comitrack -v ON_ERROR_STOP=1 -f backend/db/migraciones/2026-11-14-opiniones.sql
CREATE TABLE IF NOT EXISTS opiniones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto       VARCHAR(400) NOT NULL CHECK (char_length(btrim(texto)) >= 5),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS opiniones_fecha_idx ON opiniones (creado_en DESC, id DESC);
