# ComiTrack

Aplicacion web para la gestion de la actividad de comisionistas independientes:
viajes, encomiendas, pasajeros, clientes e ingresos/gastos.

Proyecto del **Seminario Integrador** - UTN FRC - Comision 3k2 - Grupo N.2.

## Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Repositorio:** GitHub

## Estructura

```
comitrack/
├── backend/      -> API REST (Express + PostgreSQL)
├── frontend/     -> SPA (React + Vite)
└── package.json  -> scripts para levantar todo junto
```

## Puesta en marcha

Requisitos: Node.js 20+ y PostgreSQL instalado.

1. Instalar dependencias de todo el proy







































ecto:

   ```bash
   npm run install:all
   ```

2. Copiar los archivos de entorno y completar `backend/.env` con los datos de PostgreSQL:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

   (en Windows CMD. En Git Bash usar `cp` en vez de `copy`.)

3. Crear una base vacía en PostgreSQL y aplicar el esquema completo:

   ```bash
   createdb comitrack
   psql -U postgres -d comitrack -v ON_ERROR_STOP=1 -f backend/db/schema.sql
   ```

   `backend/db/schema.sql` es la fuente de verdad para crear una base desde cero.

   `schema.sql` define el estado completo de una base nueva. No lo ejecutes sobre una
   base que ya contiene tablas o datos: no es un actualizador incremental. La base
   remota configurada en este proyecto ya tiene aplicados los cambios de gastos y
   constraints de encomiendas.

4. Cargar las dos cuentas de prueba:

   ```bash
   npm --prefix backend run seed
   ```

   Se crean `cl@gmail.com` (cliente) y `comi@gmail.com` (comisionista), ambas con
   contraseña `41022834`. El seed es idempotente: no reemplaza cuentas existentes.

   Para una base nueva de prueba o staging en Render, aplicá el schema una sola
   vez contra la URL externa de PostgreSQL y ejecutá el seed con `DATABASE_URL`
   configurada. El seed usa una contraseña de prueba conocida: no lo ejecutes en
   producción. No vuelvas a crear ni aplicar el schema sobre la base actual de
   producción; el deploy no lo ejecuta automáticamente y conserva los datos.

5. Para enviar verificaciones de correo, completa en `backend/.env` `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`. `FRONTEND_URL` debe apuntar al sitio que abrirá
   el enlace (en desarrollo, `http://localhost:5173`).

6. Levantar backend + frontend a la vez:

   ```bash
   npm run dev
   ```

   - API: http://localhost:4000/api/health
   - Web: http://localhost:5173

## Convenciones

- Ramas: `main` (estable) + una rama por historia de usuario, ej: `feature/US10-registrar-encomienda`.
- Commits cortos y descriptivos en español.
