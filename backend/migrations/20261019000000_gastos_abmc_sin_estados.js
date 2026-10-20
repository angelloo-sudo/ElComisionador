// Epica 7 (ajuste): gastos y tipos de gasto son un ABMC sin estados. La baja elimina el registro.
// El tipo de gasto pasa a ser el "concepto" de cada gasto, por eso es obligatorio y se quita gastos.concepto.
// Los gastos dados de baja con la version anterior se eliminan; los que tenian un concepto propio
// conservan ese texto como un tipo de gasto nuevo del mismo comisionista.
export const up = (pgm) => {
  pgm.sql(String.raw`
DELETE FROM gastos WHERE activo = false;
DELETE FROM tipos_gasto t
WHERE t.activo = false AND NOT EXISTS (SELECT 1 FROM gastos g WHERE g.tipo_gasto_id = t.id);

-- Gastos sin tipo: su concepto pasa a ser un tipo de gasto.
INSERT INTO tipos_gasto (usuario_id, nombre)
SELECT DISTINCT g.usuario_id, left(btrim(g.concepto), 60)
FROM gastos g
WHERE g.tipo_gasto_id IS NULL AND char_length(btrim(g.concepto)) >= 3
ON CONFLICT DO NOTHING;

UPDATE gastos g SET tipo_gasto_id = t.id
FROM tipos_gasto t
WHERE g.tipo_gasto_id IS NULL AND t.usuario_id = g.usuario_id AND lower(t.nombre) = lower(left(btrim(g.concepto), 60));

INSERT INTO tipos_gasto (usuario_id, nombre)
SELECT DISTINCT g.usuario_id, 'Otros' FROM gastos g WHERE g.tipo_gasto_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE gastos g SET tipo_gasto_id = t.id
FROM tipos_gasto t
WHERE g.tipo_gasto_id IS NULL AND t.usuario_id = g.usuario_id AND lower(t.nombre) = 'otros';

DROP INDEX IF EXISTS tipos_gasto_nombre_activo_uq;
ALTER TABLE tipos_gasto DROP COLUMN IF EXISTS activo, DROP COLUMN IF EXISTS baja_en;
ALTER TABLE gastos DROP COLUMN IF EXISTS concepto, DROP COLUMN IF EXISTS activo, DROP COLUMN IF EXISTS baja_en;
ALTER TABLE gastos ALTER COLUMN tipo_gasto_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_gasto_nombre_uq ON tipos_gasto (usuario_id, lower(nombre));
`)
}

export const down = (pgm) => {
  pgm.sql(String.raw`
DROP INDEX IF EXISTS tipos_gasto_nombre_uq;
ALTER TABLE tipos_gasto ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS baja_en TIMESTAMPTZ;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS concepto VARCHAR(120), ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS baja_en TIMESTAMPTZ;
UPDATE gastos g SET concepto = t.nombre FROM tipos_gasto t WHERE t.id = g.tipo_gasto_id;
ALTER TABLE gastos ALTER COLUMN concepto SET NOT NULL, ALTER COLUMN tipo_gasto_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_gasto_nombre_activo_uq ON tipos_gasto (usuario_id, lower(nombre)) WHERE activo;
`)
}
