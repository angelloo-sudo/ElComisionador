-- Esquema inicial de ComiTrack (PostgreSQL)
-- Ejecutar sobre una base ya creada:  psql -U postgres -d comitrack -f schema.sql

-- Epica 1: usuarios (comisionista, cliente y administrador), con roles.
-- Guarda SOLO los datos de cuenta/login. Los datos de contacto de un cliente
-- (DNI, telefono, direccion) viven en la tabla "clientes" de abajo, 1 a 1.
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  apellido      VARCHAR(120),
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) NOT NULL DEFAULT 'cliente'
                CHECK (rol IN ('comisionista', 'cliente', 'administrador')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  email_verificado BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- Las cuentas existentes se conservan verificadas; los nuevos registros se crean pendientes.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT true;

-- Datos de contacto propios de un cliente. 1 a 1 con usuarios: solo existe una fila
-- aca cuando el usuario tiene rol = 'cliente'. Si se borra el usuario (baja, US12),
-- esta fila se borra en cascada automaticamente.
-- NOTA: dni y telefono son obligatorios a nivel de aplicacion (ver validators/),
-- no se marcan NOT NULL aca para no romper bases ya creadas con datos previos.
CREATE TABLE IF NOT EXISTS clientes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni         VARCHAR(20),
  telefono    VARCHAR(40),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- Datos de perfil propios de un comisionista. 1 a 1 con usuarios, igual que "clientes":
-- solo existe una fila aca cuando el usuario tiene rol = 'comisionista'. Si se borra el
-- usuario (baja), esta fila se borra en cascada.
--   dni / telefono : se piden al registrarse (obligatorios a nivel de aplicacion).
--   presentacion   : texto breve que el comisionista carga despues, para que lo vea el cliente.
--   foto_perfil    : imagen (data URL jpeg/png/webp) ya achicada por el navegador (~50 KB).
CREATE TABLE IF NOT EXISTS comisionistas (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  dni           VARCHAR(20),
  telefono      VARCHAR(40),
  presentacion  TEXT,
  foto_perfil   TEXT,
  creado_en     TIMESTAMP DEFAULT NOW()
);

-- Si tu base ya existia de antes (con barrio/calle/altura/descripcion), esto la
-- pone al dia sin perder el resto de los datos. Correr una sola vez.
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

-- Si tu base ya existia de antes, esto agrega los campos nuevos (correr una sola vez):
--   hora_llegada    : hora aproximada de llegada al destino
--   serie_id        : identifica a los viajes creados juntos como "repetitivos"
--   repeticion_dias : dias de la semana de la repeticion (0=Dom ... 6=Sab, ej '1,3,5');
--                     NULL = viaje unico. 'todos' cuando se repite todos los dias.
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS hora_llegada TIME;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS serie_id UUID;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS repeticion_dias VARCHAR(20);

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
