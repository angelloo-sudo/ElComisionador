-- Esquema actual de ComiTrack (PostgreSQL).
-- Ejecutar sobre una base nueva: psql -d comitrack -v ON_ERROR_STOP=1 -f backend/db/schema.sql

CREATE TABLE usuarios (
  id                    SERIAL PRIMARY KEY,
  nombre                VARCHAR(120) NOT NULL,
  apellido              VARCHAR(120),
  email                 VARCHAR(120) UNIQUE NOT NULL,
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

CREATE TABLE clientes (
  id                                      SERIAL PRIMARY KEY,
  usuario_id                              INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni                                     VARCHAR(20),
  telefono                                VARCHAR(40),
  primera_solicitud_encomienda_realizada  BOOLEAN NOT NULL DEFAULT false,
  creado_en                               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comisionistas (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni           VARCHAR(20),
  telefono      VARCHAR(40),
  presentacion  TEXT,
  foto_perfil   TEXT,
  creado_en     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE viajes (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen            VARCHAR(120) NOT NULL,
  destino           VARCHAR(120) NOT NULL,
  fecha             DATE NOT NULL,
  hora_salida       TIME,
  hora_llegada      TIME,
  serie_id          UUID,
  repeticion_dias   VARCHAR(20),
  cupo_total        INTEGER DEFAULT 0,
  estado            VARCHAR(20) DEFAULT 'programado'
                    CHECK (estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
  creado_en         TIMESTAMP DEFAULT NOW()
);

CREATE TABLE encomiendas (
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

CREATE TABLE historial_encomiendas (
  id             SERIAL PRIMARY KEY,
  encomienda_id  INTEGER NOT NULL REFERENCES encomiendas(id) ON DELETE CASCADE,
  estado         VARCHAR(20) NOT NULL
                 CHECK (estado IN ('pendiente', 'aceptado', 'retirado', 'recibido', 'en_viaje', 'entregado')),
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION registrar_historial_estado_encomienda()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO historial_encomiendas (encomienda_id, estado)
    VALUES (NEW.id, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encomiendas_historial_estado
AFTER INSERT OR UPDATE ON encomiendas
FOR EACH ROW EXECUTE FUNCTION registrar_historial_estado_encomienda();

CREATE TABLE pasajeros (
  id         SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  nombre     VARCHAR(120) NOT NULL,
  telefono   VARCHAR(40),
  creado_en  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE viaje_pasajero (
  viaje_id       INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  pasajero_id    INTEGER NOT NULL REFERENCES pasajeros(id) ON DELETE CASCADE,
  punto_ascenso  VARCHAR(200),
  punto_descenso VARCHAR(200),
  monto          NUMERIC(12,2) DEFAULT 0,
  estado         VARCHAR(20) NOT NULL DEFAULT 'activo'
                 CHECK (estado IN ('activo', 'cancelado')),
  PRIMARY KEY (viaje_id, pasajero_id)
);

CREATE TABLE solicitudes_viaje (
  id                    SERIAL PRIMARY KEY,
  viaje_id              INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  cliente_id            INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo                  VARCHAR(12) NOT NULL CHECK (tipo IN ('pasajero', 'encomienda')),
  estado                VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  origen_calle          VARCHAR(100) NOT NULL,
  origen_altura         VARCHAR(10) NOT NULL,
  origen_barrio         VARCHAR(100) NOT NULL,
  origen_descripcion    VARCHAR(300),
  destino_calle         VARCHAR(100) NOT NULL,
  destino_altura        VARCHAR(10) NOT NULL,
  destino_barrio        VARCHAR(100) NOT NULL,
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
  creado_en             TIMESTAMP DEFAULT NOW(),
  resuelto_en           TIMESTAMP
);

CREATE INDEX solicitudes_viaje_viaje_idx ON solicitudes_viaje (viaje_id, estado);
CREATE INDEX solicitudes_viaje_cliente_idx ON solicitudes_viaje (cliente_id);

CREATE TABLE ingresos (
  id        SERIAL PRIMARY KEY,
  viaje_id  INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  concepto  VARCHAR(120),
  monto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha     DATE DEFAULT CURRENT_DATE
);

CREATE TABLE tipos_gasto (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre         VARCHAR(60) NOT NULL,
  descripcion    VARCHAR(200),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(btrim(nombre)) >= 3)
);

CREATE UNIQUE INDEX tipos_gasto_nombre_uq ON tipos_gasto (usuario_id, lower(nombre));

CREATE TABLE gastos (
  id             SERIAL PRIMARY KEY,
  viaje_id       INTEGER REFERENCES viajes(id) ON DELETE CASCADE,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_gasto_id  INTEGER NOT NULL REFERENCES tipos_gasto(id),
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha          DATE NOT NULL,
  descripcion    VARCHAR(500),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX gastos_usuario_fecha_idx ON gastos (usuario_id, fecha DESC);
CREATE INDEX gastos_tipo_gasto_idx ON gastos (tipo_gasto_id);
