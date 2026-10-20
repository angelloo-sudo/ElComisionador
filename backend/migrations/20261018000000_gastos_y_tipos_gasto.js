// Epica 7 (US40-US48): administracion de gastos y tipos de gasto.
//
// - Nueva tabla tipos_gasto: categorias propias de cada comisionista (alta, modificacion, baja logica).
// - La tabla gastos (del esquema inicial) estaba pensada solo para gastos de un viaje y con una
//   categoria fija. Ahora es un gasto del comisionista (usuario_id), con concepto, descripcion, baja
//   logica y un tipo de gasto opcional. viaje_id se conserva (opcional) para la Epica 8.
// - Los gastos que ya existieran conservan su categoria: se convierte en un tipo de gasto del dueno.
//
// No se borra ningun dato: las bajas son logicas (activo = false) para no perder el historial.
export const up = (pgm) => {
  pgm.sql(String.raw`
-- 1) Tipos de gasto
CREATE TABLE IF NOT EXISTS tipos_gasto (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre         VARCHAR(60) NOT NULL,
  descripcion    VARCHAR(200),
  activo         BOOLEAN NOT NULL DEFAULT true,
  baja_en        TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(btrim(nombre)) >= 3)
);

-- El nombre no se puede repetir entre los tipos activos de un mismo comisionista (sin distinguir
-- mayusculas). Si un tipo se da de baja, su nombre queda libre para volver a usarlo.
CREATE UNIQUE INDEX IF NOT EXISTS tipos_gasto_nombre_activo_uq
  ON tipos_gasto (usuario_id, lower(nombre)) WHERE activo;

-- 2) Gastos: pasan a pertenecer al comisionista
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_gasto_id  INTEGER REFERENCES tipos_gasto(id),
  ADD COLUMN IF NOT EXISTS concepto       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS descripcion    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS activo         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS baja_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) Gastos que ya existian: el dueno es el del viaje, y su categoria pasa a ser un tipo de gasto.
UPDATE gastos g SET usuario_id = v.usuario_id
FROM viajes v
WHERE g.viaje_id = v.id AND g.usuario_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gastos WHERE usuario_id IS NULL) THEN
    RAISE EXCEPTION 'Hay gastos sin viaje ni comisionista asociado; asignales un usuario_id antes de migrar.';
  END IF;
END $$;

INSERT INTO tipos_gasto (usuario_id, nombre)
SELECT DISTINCT g.usuario_id,
       CASE g.categoria
         WHEN 'combustible'   THEN 'Combustible'
         WHEN 'peaje'         THEN 'Peajes'
         WHEN 'mantenimiento' THEN 'Mantenimiento'
         ELSE 'Otros'
       END
FROM gastos g
WHERE g.tipo_gasto_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE gastos g
SET tipo_gasto_id = t.id,
    concepto = COALESCE(g.concepto, t.nombre)
FROM tipos_gasto t
WHERE g.tipo_gasto_id IS NULL
  AND t.usuario_id = g.usuario_id
  AND lower(t.nombre) = lower(CASE g.categoria
         WHEN 'combustible'   THEN 'Combustible'
         WHEN 'peaje'         THEN 'Peajes'
         WHEN 'mantenimiento' THEN 'Mantenimiento'
         ELSE 'Otros'
       END);

UPDATE gastos SET concepto = 'Gasto' WHERE concepto IS NULL;
UPDATE gastos SET fecha = CURRENT_DATE WHERE fecha IS NULL;

-- 4) Restricciones definitivas
ALTER TABLE gastos
  ALTER COLUMN usuario_id SET NOT NULL,
  ALTER COLUMN concepto   SET NOT NULL,
  ALTER COLUMN fecha      SET NOT NULL,
  ALTER COLUMN monto      DROP DEFAULT;

-- NOT VALID: se exige para los gastos nuevos o modificados sin frenar la migracion por datos viejos.
ALTER TABLE gastos DROP CONSTRAINT IF EXISTS gastos_monto_positivo;
ALTER TABLE gastos ADD CONSTRAINT gastos_monto_positivo CHECK (monto > 0) NOT VALID;

ALTER TABLE gastos DROP COLUMN IF EXISTS categoria;

CREATE INDEX IF NOT EXISTS gastos_usuario_fecha_idx ON gastos (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS gastos_tipo_gasto_idx ON gastos (tipo_gasto_id);
`)
}

export const down = (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(20) DEFAULT 'otro'
  CHECK (categoria IN ('combustible', 'peaje', 'mantenimiento', 'otro'));

-- Mejor esfuerzo: recupera la categoria fija a partir del nombre del tipo de gasto.
UPDATE gastos g
SET categoria = CASE lower(t.nombre)
  WHEN 'combustible'   THEN 'combustible'
  WHEN 'peajes'        THEN 'peaje'
  WHEN 'peaje'         THEN 'peaje'
  WHEN 'mantenimiento' THEN 'mantenimiento'
  ELSE 'otro'
END
FROM tipos_gasto t
WHERE g.tipo_gasto_id = t.id;

DROP INDEX IF EXISTS gastos_tipo_gasto_idx;
DROP INDEX IF EXISTS gastos_usuario_fecha_idx;
ALTER TABLE gastos DROP CONSTRAINT IF EXISTS gastos_monto_positivo;
ALTER TABLE gastos
  ALTER COLUMN monto SET DEFAULT 0,
  ALTER COLUMN fecha DROP NOT NULL,
  DROP COLUMN IF EXISTS actualizado_en,
  DROP COLUMN IF EXISTS creado_en,
  DROP COLUMN IF EXISTS baja_en,
  DROP COLUMN IF EXISTS activo,
  DROP COLUMN IF EXISTS descripcion,
  DROP COLUMN IF EXISTS concepto,
  DROP COLUMN IF EXISTS tipo_gasto_id,
  DROP COLUMN IF EXISTS usuario_id;
DROP TABLE IF EXISTS tipos_gasto;
`)
}
