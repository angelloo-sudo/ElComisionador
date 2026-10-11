# Migraciones de base de datos

Las migraciones son la fuente para evolucionar el esquema compartido. No edites una migración que ya se aplicó o se publicó; agregá otra con el cambio nuevo.

## Requisitos

- Node.js 20.11 o superior.
- PostgreSQL disponible.
- `backend/.env` configurado con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`.

## Base nueva

Creá primero la base vacía en PostgreSQL y luego, desde la raíz del repositorio, ejecutá:

```bash
npm --prefix backend run migrate:up
```

También se puede usar el alias `npm --prefix backend run migrate`.

## Crear y aplicar una migración

Creá un archivo con un nombre descriptivo:

```bash
npm --prefix backend run migrate:create -- agregar-campo-cliente
```

Completá sus acciones `up` y `down`. `up` aplica el cambio; `down` lo revierte. Antes de compartir la migración, probá ambas direcciones en una base de desarrollo.

Para aplicar todas las migraciones pendientes:

```bash
npm --prefix backend run migrate:up
```

Para revertir la última migración:

```bash
npm --prefix backend run migrate:down
```

## Después de hacer pull

Instalá dependencias si cambió `backend/package-lock.json` y aplicá las migraciones pendientes:

```bash
npm --prefix backend install
npm --prefix backend run migrate:up
```

Si el lockfile no cambió, alcanza con correr `npm --prefix backend run migrate:up`.

## Bases que ya se inicializaron con schema.sql

La migración inicial reproduce el esquema actual y el SQL de compatibilidad del `schema.sql` de referencia. Si tu base ya contiene ese esquema, no la reviertas ni la recrees. Verificá que corresponda al esquema actual y registrá la migración inicial como aplicada sin volver a ejecutar su SQL:

```bash
npm --prefix backend run migrate:baseline
```

`migrate:baseline` usa el modo `fake` de node-pg-migrate: registra las migraciones pendientes como aplicadas sin ejecutar sus sentencias. Usalo solo para bases que ya tengan el esquema de esa migración. A partir de entonces, al hacer pull, usá `migrate:up` normalmente.

No ejecutes `migrate:down` sobre una base baselined para revertir la migración inicial: su `down` elimina las tablas del esquema. Para probar rollbacks, usá una base descartable.

## Referencia

Se conserva `src/db/schema.sql` como referencia histórica. Los cambios nuevos deben ir en archivos de `migrations/` y no en ese SQL.