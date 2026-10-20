export const up = (pgm) => {
  pgm.sql(String.raw`-- Esquema inicial de ComiTrack (PostgreSQL)
-- Epica 1: usuarios y perfiles
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  apellido      VARCHAR(120),
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) NOT NULL DEFAULT 'cliente'
                CHECK (rol IN ('comisionista', 'cliente', 'administrador')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  reset_token         VARCHAR(255),
  reset_token_expira  TIMESTAMP,
  email_verificado    BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMP DEFAULT NOW()
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellido VARCHAR(120);
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cliente'
  CHECK (rol IN ('comisionista', 'cliente', 'administrador'));

CREATE TABLE IF NOT EXISTS clientes (
  id                                  SERIAL PRIMARY KEY,
  usuario_id                          INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni                                 VARCHAR(20),
  telefono                            VARCHAR(40),
  primera_solicitud_encomienda_realizada BOOLEAN NOT NULL DEFAULT false,
  creado_en                           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comisionistas (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni           VARCHAR(20),
  telefono      VARCHAR(40),
  presentacion  TEXT,
  foto_perfil   TEXT,
  creado_en     TIMESTAMP DEFAULT NOW()
);

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS primera_solicitud_encomienda_realizada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes DROP COLUMN IF EXISTS barrio;
ALTER TABLE clientes DROP COLUMN IF EXISTS calle;
ALTER TABLE clientes DROP COLUMN IF EXISTS altura;
ALTER TABLE clientes DROP COLUMN IF EXISTS descripcion;

-- Epica 4: viajes
CREATE TABLE IF NOT EXISTS viajes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen      VARCHAR(120) NOT NULL,
  destino     VARCHAR(120) NOT NULL,
  fecha       DATE NOT NULL,
  hora_salida TIME,
  hora_llegada TIME,
  serie_id    UUID,
  repeticion_dias VARCHAR(20),
  cupo_total  INTEGER DEFAULT 0,
  estado      VARCHAR(20) DEFAULT 'programado'
              CHECK (estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
  creado_en   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_llegada TIME;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS serie_id UUID;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS repeticion_dias VARCHAR(20);

-- Epica 3: encomiendas
CREATE TABLE IF NOT EXISTS encomiendas (
  id                     SERIAL PRIMARY KEY,
  viaje_id               INTEGER REFERENCES viajes(id) ON DELETE SET NULL,
  cliente_remitente_id   INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  remitente_nombre       VARCHAR(241),
  remitente_telefono     VARCHAR(40),
  direccion_retiro       VARCHAR(200),
  destinatario_nombre    VARCHAR(120) NOT NULL,
  destinatario_telefono  VARCHAR(40),
  destinatario_direccion VARCHAR(200),
  tipo_contenido         VARCHAR(30) CHECK (tipo_contenido IN ('electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro')),
  peso_kg                NUMERIC(8,2) CHECK (peso_kg > 0),
  dimensiones            VARCHAR(10) CHECK (dimensiones IN ('0.5x0.5', '1x1', '2x2')),
  tamano                 VARCHAR(10) CHECK (tamano IN ('pequeno', 'mediano', 'grande')),
  fragil                 BOOLEAN,
  descripcion            TEXT,
  monto_flete            NUMERIC(12,2) DEFAULT 0,
  estado                 VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  estado_pago            VARCHAR(20) CHECK (estado_pago IN ('pendiente', 'pagado', 'reembolsado')),
  fecha_solicitud        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en              TIMESTAMP DEFAULT NOW(),
  CHECK (peso_kg IS NULL OR peso_kg > 0),
  CHECK (dimensiones IS NULL OR dimensiones IN ('0.5x0.5', '1x1', '2x2'))
);

ALTER TABLE encomiendas
  ADD COLUMN IF NOT EXISTS tipo_contenido VARCHAR(30)
    CHECK (tipo_contenido IN ('electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro'));
ALTER TABLE encomiendas
  ADD COLUMN IF NOT EXISTS tamano VARCHAR(10)
    CHECK (tamano IN ('pequeno', 'mediano', 'grande'));
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS fragil BOOLEAN;
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS remitente_nombre VARCHAR(241);
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS remitente_telefono VARCHAR(40);
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS direccion_retiro VARCHAR(200);
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS peso_kg NUMERIC(8,2) CHECK (peso_kg > 0);
ALTER TABLE encomiendas
  ADD COLUMN IF NOT EXISTS dimensiones VARCHAR(10)
    CHECK (dimensiones IN ('0.5x0.5', '1x1', '2x2'));
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20);
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS fecha_solicitud TIMESTAMPTZ;

UPDATE encomiendas
SET dimensiones = CASE tamano
  WHEN 'pequeno' THEN '0.5x0.5'
  WHEN 'mediano' THEN '1x1'
  WHEN 'grande' THEN '2x2'
  ELSE dimensiones
END
WHERE dimensiones IS NULL;
UPDATE encomiendas SET fecha_solicitud = creado_en WHERE fecha_solicitud IS NULL;
ALTER TABLE encomiendas ALTER COLUMN fecha_solicitud SET DEFAULT NOW();
ALTER TABLE encomiendas ALTER COLUMN fecha_solicitud SET NOT NULL;

ALTER TABLE encomiendas ALTER COLUMN estado SET DEFAULT 'pendiente';
ALTER TABLE encomiendas DROP CONSTRAINT IF EXISTS encomiendas_estado_check;
UPDATE encomiendas SET estado = 'pendiente' WHERE estado = 'recibido';
ALTER TABLE encomiendas
  ADD CONSTRAINT encomiendas_estado_check
  CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'));
ALTER TABLE encomiendas ALTER COLUMN estado_pago DROP NOT NULL;
ALTER TABLE encomiendas ALTER COLUMN estado_pago DROP DEFAULT;
ALTER TABLE encomiendas DROP CONSTRAINT IF EXISTS encomiendas_estado_pago_check;
UPDATE encomiendas
SET estado_pago = CASE
  WHEN estado IN ('aceptado', 'en_viaje', 'entregado') THEN COALESCE(estado_pago, 'pendiente')
  ELSE NULL
END;
ALTER TABLE encomiendas
  ADD CONSTRAINT encomiendas_estado_pago_check
  CHECK (estado_pago IS NULL OR estado_pago IN ('pendiente', 'pagado', 'reembolsado'));

CREATE TABLE IF NOT EXISTS historial_encomiendas (
  id             SERIAL PRIMARY KEY,
  encomienda_id  INTEGER NOT NULL REFERENCES encomiendas(id) ON DELETE CASCADE,
  estado         VARCHAR(20) NOT NULL,
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'))
);

ALTER TABLE historial_encomiendas DROP CONSTRAINT IF EXISTS historial_encomiendas_estado_check;
ALTER TABLE historial_encomiendas
  ADD CONSTRAINT historial_encomiendas_estado_check
  CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado'));

CREATE OR REPLACE FUNCTION registrar_historial_estado_encomienda()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO historial_encomiendas (encomienda_id, estado)
    VALUES (NEW.id, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encomiendas_historial_estado ON encomiendas;
CREATE TRIGGER encomiendas_historial_estado
AFTER INSERT OR UPDATE ON encomiendas
FOR EACH ROW EXECUTE FUNCTION registrar_historial_estado_encomienda();

UPDATE clientes c
SET primera_solicitud_encomienda_realizada = true
WHERE EXISTS (
  SELECT 1 FROM encomiendas e
  WHERE e.cliente_remitente_id = c.id
);

-- Epica 4: pasajeros y su relacion con viajes
CREATE TABLE IF NOT EXISTS pasajeros (
  id         SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  nombre     VARCHAR(120) NOT NULL,
  telefono   VARCHAR(40),
  creado_en  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS viaje_pasajero (
  viaje_id       INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  pasajero_id    INTEGER NOT NULL REFERENCES pasajeros(id) ON DELETE CASCADE,
  punto_ascenso  VARCHAR(200),
  punto_descenso VARCHAR(200),
  monto          NUMERIC(12,2) DEFAULT 0,
  estado         VARCHAR(20) NOT NULL DEFAULT 'activo'
                 CHECK (estado IN ('activo', 'cancelado')),
  PRIMARY KEY (viaje_id, pasajero_id)
);

ALTER TABLE viaje_pasajero ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo'
  CHECK (estado IN ('activo', 'cancelado'));

-- Epica 5: ingresos y gastos
CREATE TABLE IF NOT EXISTS ingresos (
  id        SERIAL PRIMARY KEY,
  viaje_id  INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  concepto  VARCHAR(120),
  monto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha     DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS gastos (
  id        SERIAL PRIMARY KEY,
  viaje_id  INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  categoria VARCHAR(20) DEFAULT 'otro'
            CHECK (categoria IN ('combustible', 'peaje', 'mantenimiento', 'otro')),
  monto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha     DATE DEFAULT CURRENT_DATE
);`)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS gastos, ingresos, viaje_pasajero, pasajeros,
    historial_encomiendas, encomiendas, viajes, comisionistas, clientes, usuarios CASCADE;
    DROP FUNCTION IF EXISTS registrar_historial_estado_encomienda();`)
}