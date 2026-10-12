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

3. Crear la base "comitrack" en PostgreSQL y aplicar el esquema inicial:

   ```bash
   npm --prefix backend run migrate:up
   ```

   Para bases existentes que ya tienen el esquema actual cargado desde `schema.sql`, seguí el paso de baseline de [backend/MIGRATIONS.md](backend/MIGRATIONS.md) en lugar de recrear la base.

4. Para enviar verificaciones de correo, completa en `backend/.env` `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`. `FRONTEND_URL` debe apuntar al sitio que abrirá
   el enlace (en desarrollo, `http://localhost:5173`).

5. Levantar backend + frontend a la vez:

   ```bash
   npm run dev
   ```

   - API: http://localhost:4000/api/health
   - Web: http://localhost:5173

## Convenciones

- Ramas: `main` (estable) + una rama por historia de usuario, ej: `feature/US10-registrar-encomienda`.
- Commits cortos y descriptivos en español.
