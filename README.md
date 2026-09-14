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

Requisitos: Node.js 18+ y PostgreSQL instalado.

1. Instalar dependencias de todo el proyecto:

   ```bash
   npm run install:all
   ```

2. Crear la base y las tablas (una vez creada la base "comitrack" en PostgreSQL):

   ```bash
   psql -U postgres -d comitrack -f backend/src/db/schema.sql
   ```

3. Copiar los archivos de entorno y completarlos:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

   (en Windows CMD. En Git Bash usar `cp` en vez de `copy`.)

4. Levantar backend + frontend a la vez:

   ```bash
   npm run dev
   ```

   - API: http://localhost:4000/api/health
   - Web: http://localhost:5173

## Convenciones

- Ramas: `main` (estable) + una rama por historia de usuario, ej: `feature/US10-registrar-encomienda`.
- Commits cortos y descriptivos en español.
