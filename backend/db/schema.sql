-- Esquema actual de ComiTrack (PostgreSQL).
-- Se puede ejecutar sobre una base nueva O sobre una ya existente (no borra datos): crea lo que falta
-- y agrega las columnas nuevas. psql -d comitrack -v ON_ERROR_STOP=1 -f backend/db/schema.sql

CREATE TABLE IF NOT EXISTS usuarios (
  id                    SERIAL PRIMARY KEY,
  nombre                VARCHAR(120) NOT NULL,
  apellido              VARCHAR(120),
  email                 VARCHAR(120) UNIQUE NOT NULL,
  dni                   VARCHAR(20),
  password_hash         VARCHAR(255) NOT NULL,
  rol                   VARCHAR(20) NOT NULL DEFAULT 'cliente'
                        CHECK (rol IN ('comisionista', 'cliente', 'administrador')),
  activo                BOOLEAN NOT NULL DEFAULT true,
  reset_token           VARCHAR(255),
  reset_token_expira    TIMESTAMP,
  email_verificado      BOOLEAN NOT NULL DEFAULT true,
  login_failed_attempts INTEGER NOT NULL DEFAULT 0,
  login_lock_level      INTEGER NOT NULL DEFAULT 0,
  login_locked_until    TIMESTAMPTZ,
  creado_en             TIMESTAMP DEFAULT NOW()
);

-- Identificador personal canónico. `id` se conserva como clave técnica para las
-- relaciones existentes; el DNI identifica de forma única a cada persona.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_lock_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS clientes (
  id                                      SERIAL PRIMARY KEY,
  usuario_id                              INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni                                     VARCHAR(20),
  telefono                                VARCHAR(40),
  primera_solicitud_encomienda_realizada  BOOLEAN NOT NULL DEFAULT false,
  creado_en                               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comisionistas (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni           VARCHAR(20),
  telefono      VARCHAR(40),
  presentacion  TEXT,
  foto_perfil   TEXT,
  precio_km     NUMERIC(10,2) CHECK (precio_km IS NULL OR precio_km > 0),
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- Migrar los DNI ya guardados en las tablas de rol al registro canónico del usuario.
UPDATE usuarios u SET dni = c.dni
FROM clientes c
WHERE c.usuario_id = u.id AND NULLIF(BTRIM(c.dni), '') IS NOT NULL AND u.dni IS NULL;
UPDATE usuarios u SET dni = m.dni
FROM comisionistas m
WHERE m.usuario_id = u.id AND NULLIF(BTRIM(m.dni), '') IS NOT NULL AND u.dni IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_dni_uq ON usuarios (dni) WHERE dni IS NOT NULL;

CREATE TABLE IF NOT EXISTS viajes (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen            VARCHAR(120) NOT NULL,
  destino           VARCHAR(120) NOT NULL,
  fecha             DATE NOT NULL,
  hora_salida       TIME,
  hora_llegada      TIME,
  distancia_km      NUMERIC(8,1),
  duracion_min      INTEGER,
  serie_id          UUID,
  repeticion_dias   VARCHAR(20),
  cupo_total        INTEGER DEFAULT 0,
  estado            VARCHAR(20) DEFAULT 'programado'
                    CHECK (estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
  creado_en         TIMESTAMP DEFAULT NOW()
);

-- US26: recordatorio automatico del comisionista para un viaje.
CREATE TABLE IF NOT EXISTS recordatorios_viaje (
  id                       SERIAL PRIMARY KEY,
  viaje_id                 INTEGER NOT NULL UNIQUE REFERENCES viajes(id) ON DELETE CASCADE,
  minutos_anticipacion     INTEGER NOT NULL CHECK (minutos_anticipacion > 0),
  programado_para          TIMESTAMPTZ NOT NULL,
  estado                   VARCHAR(16) NOT NULL DEFAULT 'pendiente'
                           CHECK (estado IN ('pendiente', 'procesando', 'enviado', 'cancelado')),
  procesamiento_iniciado_en TIMESTAMPTZ,
  enviado_en               TIMESTAMPTZ,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  tipo_contenido         VARCHAR(30)
                         CHECK (tipo_contenido IN ('electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro')),
  peso_kg                NUMERIC(8,2) CHECK (peso_kg > 0),
  dimensiones            VARCHAR(10)
                         CHECK (dimensiones IN ('0.5x0.5', '1x1', '2x2')),
  tamano                 VARCHAR(10)
                         CHECK (tamano IN ('pequeno', 'mediano', 'grande')),
  fragil                 BOOLEAN,
  descripcion            TEXT,
  monto_flete            NUMERIC(12,2) DEFAULT 0,
  estado                 VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado')),
  estado_pago            VARCHAR(20)
                         CHECK (estado_pago IS NULL OR estado_pago IN ('pendiente', 'pagado', 'reembolsado')),
  fecha_solicitud        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historial_encomiendas (
  id             SERIAL PRIMARY KEY,
  encomienda_id  INTEGER NOT NULL REFERENCES encomiendas(id) ON DELETE CASCADE,
  estado         VARCHAR(20) NOT NULL
                 CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado')),
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS solicitudes_viaje (
  id                    SERIAL PRIMARY KEY,
  viaje_id              INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  cliente_id            INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo                  VARCHAR(12) NOT NULL CHECK (tipo IN ('pasajero', 'encomienda')),
  estado                VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  origen_calle          VARCHAR(100) NOT NULL,
  origen_altura         VARCHAR(10) NOT NULL,
  origen_barrio         VARCHAR(100),
  origen_codigo_postal  VARCHAR(8),
  origen_descripcion    VARCHAR(300),
  destino_calle         VARCHAR(100) NOT NULL,
  destino_altura        VARCHAR(10) NOT NULL,
  destino_barrio        VARCHAR(100),
  destino_codigo_postal VARCHAR(8),
  nombre                VARCHAR(120),
  apellido              VARCHAR(120),
  dni                   VARCHAR(20),
  telefono              VARCHAR(40),
  lleva_equipaje        BOOLEAN,
  equipaje_detalle      VARCHAR(300),
  cantidad_pasajeros    INTEGER CHECK (cantidad_pasajeros >= 1),
  forma_pago            VARCHAR(15) CHECK (forma_pago IN ('efectivo', 'transferencia')),
  peso_kg               NUMERIC(8,2) CHECK (peso_kg > 0),
  ancho_cm              NUMERIC(8,2) CHECK (ancho_cm > 0),
  largo_cm              NUMERIC(8,2) CHECK (largo_cm > 0),
  emisor_nombre         VARCHAR(120),
  emisor_apellido       VARCHAR(120),
  emisor_telefono       VARCHAR(40),
  receptor_nombre       VARCHAR(120),
  receptor_apellido     VARCHAR(120),
  receptor_telefono     VARCHAR(40),
  fragil                BOOLEAN,
  tipo_contenido        VARCHAR(30)
                        CHECK (tipo_contenido IN ('electronica', 'ropa', 'alimentos', 'libros', 'hogar', 'documentacion', 'juguetes', 'otro')),
  contenido_descripcion VARCHAR(300),
  motivo_rechazo        VARCHAR(300),
  origen_localidad      VARCHAR(120),
  destino_localidad     VARCHAR(120),
  distancia_km          NUMERIC(8,1),
  precio_km             NUMERIC(10,2),
  monto                 NUMERIC(12,2),
  creado_en             TIMESTAMP DEFAULT NOW(),
  resuelto_en           TIMESTAMP
);

CREATE INDEX IF NOT EXISTS solicitudes_viaje_viaje_idx ON solicitudes_viaje (viaje_id, estado);
CREATE INDEX IF NOT EXISTS solicitudes_viaje_cliente_idx ON solicitudes_viaje (cliente_id);

CREATE TABLE IF NOT EXISTS ingresos (
  id        SERIAL PRIMARY KEY,
  viaje_id  INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  concepto  VARCHAR(120),
  monto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha     DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS tipos_gasto (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre         VARCHAR(60) NOT NULL,
  descripcion    VARCHAR(200),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(btrim(nombre)) >= 3)
);

-- Compatibilidad con una tabla de tipos previa que no tuviera propietario.
ALTER TABLE tipos_gasto ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_gasto_nombre_uq ON tipos_gasto (usuario_id, lower(nombre));

CREATE TABLE IF NOT EXISTS gastos (
  id             SERIAL PRIMARY KEY,
  viaje_id       INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_gasto_id  INTEGER NOT NULL REFERENCES tipos_gasto(id),
  categoria      VARCHAR(60),
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha          DATE NOT NULL,
  descripcion    VARCHAR(500),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migración aditiva de la tabla de gastos anterior (viaje_id/categoria/monto/fecha).
-- No se elimina categoria: se conserva como dato legado mientras tipo_gasto_id pasa
-- a ser la relación usada por la aplicación.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_gasto_id INTEGER REFERENCES tipos_gasto(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS categoria VARCHAR(60);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Recuperar el propietario desde el viaje histórico y convertir categorias legadas
-- en tipos de gasto propios de cada comisionista.
UPDATE gastos g SET usuario_id = v.usuario_id
FROM viajes v
WHERE g.viaje_id = v.id AND g.usuario_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gastos WHERE usuario_id IS NULL) THEN
    RAISE EXCEPTION 'No se pudo determinar el comisionista de uno o más gastos antiguos; completar gastos.usuario_id antes de continuar';
  END IF;
END;
$$;

INSERT INTO tipos_gasto (usuario_id, nombre)
SELECT DISTINCT g.usuario_id,
       LEFT(INITCAP(REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(g.categoria), ''), 'Otros'), '\s+', ' ', 'g')), 60)
FROM gastos g
WHERE g.tipo_gasto_id IS NULL
ON CONFLICT (usuario_id, lower(nombre)) DO NOTHING;

UPDATE gastos g
SET tipo_gasto_id = t.id
FROM tipos_gasto t
WHERE g.tipo_gasto_id IS NULL
  AND t.usuario_id = g.usuario_id
  AND LOWER(t.nombre) = LOWER(LEFT(INITCAP(REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(g.categoria), ''), 'Otros'), '\s+', ' ', 'g')), 60));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gastos WHERE tipo_gasto_id IS NULL) THEN
    RAISE EXCEPTION 'No se pudo convertir la categoria de uno o más gastos a tipo_gasto_id';
  END IF;
END;
$$;

ALTER TABLE gastos ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE gastos ALTER COLUMN tipo_gasto_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS gastos_usuario_fecha_idx ON gastos (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS gastos_tipo_gasto_idx ON gastos (tipo_gasto_id);

-- Columnas agregadas despues (tarifa por km y duracion automatica). En una base nueva ya vienen en
-- los CREATE TABLE de arriba; en una base existente se agregan aca. No modifica datos.
ALTER TABLE comisionistas     ADD COLUMN IF NOT EXISTS precio_km    NUMERIC(10,2);
ALTER TABLE viajes            ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(8,1);
ALTER TABLE viajes            ADD COLUMN IF NOT EXISTS duracion_min INTEGER;
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(8,1);
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS precio_km    NUMERIC(10,2);
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS monto        NUMERIC(12,2);

-- US28 (flujo de solicitudes): momento en que el comisionista retiro la encomienda.
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS retirada_en TIMESTAMPTZ;
-- US33: momento en que el comisionista entrego la encomienda al destinatario.
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS entregada_en TIMESTAMPTZ;

-- US22 / US24 / US25: avance operativo del pasajero (NULL = todavia no subio).
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS estado_pasajero VARCHAR(24)
  CHECK (estado_pasajero IN ('a_bordo', 'en_destino', 'ausente', 'cancelado_comisionista'));
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS subio_en TIMESTAMPTZ;
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS llego_en TIMESTAMPTZ;

-- US35 / US37 / US38 / US39: ingresos por cobro de pasajeros y encomiendas. Se amplia la tabla
-- "ingresos" existente (no se pierden datos). Un cobro por solicitud: lo registra el sistema solo
-- cuando el pasajero llega a destino o cuando se retira la encomienda.
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS solicitud_id     INTEGER REFERENCES solicitudes_viaje(id) ON DELETE SET NULL;
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS tipo_servicio    VARCHAR(12) CHECK (tipo_servicio IN ('pasajero', 'encomienda'));
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS forma_pago       VARCHAR(15) CHECK (forma_pago IN ('efectivo', 'transferencia'));
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS estado           VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'anulado'));
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(300);
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS anulado_en       TIMESTAMPTZ;
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS ingresos_solicitud_activo_uq ON ingresos (solicitud_id) WHERE estado = 'activo' AND solicitud_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ingresos_usuario_fecha_idx ON ingresos (usuario_id, fecha DESC);

-- Paradas: localidad donde el cliente sube / se retira el paquete y donde baja / se entrega.
-- distancia_km de la solicitud pasa a ser los km de ese tramo (no del viaje completo).
-- Codigo postal de las direcciones (reemplaza al barrio; las columnas de barrio quedan para las solicitudes viejas, ahora sin NOT NULL).
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS origen_codigo_postal  VARCHAR(8);
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS destino_codigo_postal VARCHAR(8);
ALTER TABLE solicitudes_viaje ALTER COLUMN origen_barrio  DROP NOT NULL;
ALTER TABLE solicitudes_viaje ALTER COLUMN destino_barrio DROP NOT NULL;
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS origen_localidad  VARCHAR(120);
ALTER TABLE solicitudes_viaje ADD COLUMN IF NOT EXISTS destino_localidad VARCHAR(120);

-- US20 / US21: momento en que el comisionista inicio y finalizo el viaje.
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS iniciado_en   TIMESTAMPTZ;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;

-- US28: momento en que el comisionista retiro la encomienda (confirmacion de recepcion inicial).
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS retirado_en TIMESTAMPTZ;

-- US29: conservar las encomiendas canceladas y su historial; no borrarlas fisicamente.
ALTER TABLE encomiendas DROP CONSTRAINT IF EXISTS encomiendas_estado_check;
ALTER TABLE encomiendas ADD CONSTRAINT encomiendas_estado_check
  CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado', 'cancelada'));
ALTER TABLE historial_encomiendas DROP CONSTRAINT IF EXISTS historial_encomiendas_estado_check;
ALTER TABLE historial_encomiendas ADD CONSTRAINT historial_encomiendas_estado_check
  CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado', 'cancelada'));
