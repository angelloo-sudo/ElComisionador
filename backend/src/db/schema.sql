-- Esquema inicial de ComiTrack (PostgreSQL)
-- Ejecutar sobre una base ya creada:  psql -U postgres -d comitrack -f schema.sql

-- Epica 1: usuarios (comisionistas) y clientes
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre     VARCHAR(120) NOT NULL,
  telefono   VARCHAR(40),
  direccion  VARCHAR(200),
  notas      TEXT,
  creado_en  TIMESTAMP DEFAULT NOW()
);

-- Epica 2: viajes
CREATE TABLE IF NOT EXISTS viajes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origen      VARCHAR(120) NOT NULL,
  destino     VARCHAR(120) NOT NULL,
  fecha       DATE NOT NULL,
  hora_salida TIME,
  cupo_total  INTEGER DEFAULT 0,
  estado      VARCHAR(20) DEFAULT 'programado'
              CHECK (estado IN ('programado', 'en_curso', 'finalizado', 'cancelado')),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- Epica 3: encomiendas (core)
CREATE TABLE IF NOT EXISTS encomiendas (
  id                     SERIAL PRIMARY KEY,
  viaje_id               INTEGER REFERENCES viajes(id) ON DELETE SET NULL,
  cliente_remitente_id   INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  destinatario_nombre    VARCHAR(120) NOT NULL,
  destinatario_telefono  VARCHAR(40),
  destinatario_direccion VARCHAR(200),
  descripcion            TEXT,
  monto_flete            NUMERIC(12,2) DEFAULT 0,
  estado                 VARCHAR(20) DEFAULT 'recibido'
                         CHECK (estado IN ('recibido', 'en_viaje', 'entregado')),
  creado_en              TIMESTAMP DEFAULT NOW()
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
  PRIMARY KEY (viaje_id, pasajero_id)
);

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
);
