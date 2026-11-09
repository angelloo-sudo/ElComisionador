# Datos de prueba para las cuentas existentes

El seed agrega un conjunto acotado para `matiasjofree66@hotmail.com` (comisionista) y `matiasjofre6@hotmail.com` (cliente). No crea usuarios, no modifica perfiles y no elimina información existente.

Desde `backend/`:

```powershell
node scripts/seed-cuentas-demo.js --inspect
node scripts/seed-cuentas-demo.js --apply
node scripts/seed-cuentas-demo.js --verify
```

`--inspect` comprueba el destino, las cuentas, las columnas y restricciones reales sin guardar cambios. `--apply` solo acepta `DB_NAME=comitrack`, `DB_HOST=localhost` y una conexión PostgreSQL local; ejecuta los inserts en una transacción y revierte todo ante un error. `--verify` consulta las relaciones, capacidad y resultados de los snapshots sin escribir. La carga es idempotente mediante `serie_id`, descripciones/conceptos identificables y códigos de snapshot.

## Registros de demostración

- 6 viajes: cuatro finalizados, uno cancelado y uno programado.
- 6 paradas en distintos recorridos y órdenes.
- 6 solicitudes de pasajeros asociadas al cliente; se usan para la pantalla y el historial funcionales.
- 6 solicitudes de encomienda asociadas a esos viajes y 6 registros de encomienda con historial de estado.
- 8 ingresos asociados a solicitudes, sin duplicar cobros de la misma solicitud, y 7 gastos; el mantenimiento general no se asigna a un viaje.
- 6 snapshots generados con el mismo servicio que usa la aplicación: incluyen resultados positivos, negativos y equilibrados.
- Hasta 2 verificaciones pendientes, una por cuenta, con DNI ficticio parcialmente oculto y sin imágenes. No se crean aprobaciones ni rechazos: resolverlas requiere un administrador, que no forma parte de las dos cuentas autorizadas.

Los snapshots financieros reflejan todos los movimientos de esas cuentas dentro del período, igual que el flujo normal de reportes; si ya había movimientos del usuario, pueden aparecer junto con los de demostración. El período de noviembre tiene movimientos preexistentes y no está vacío. El período de enero de 2025 sí sirve para comprobar un reporte sin movimientos.

## Límites del esquema y funcionalidades

- `paradas_viaje` guarda localidad, orden y hora, pero no coordenadas ni una clave a una tabla de localidades. El seed no inventa esas columnas.
- Las reservas y su historial usan `solicitudes_viaje`. El CRUD legado de `pasajeros` responde `501`, por lo que no se crean filas duplicadas en `pasajeros`/`viaje_pasajero` para simular una funcionalidad pendiente.
- Los estados de solicitudes de encomienda y encomiendas reales se limitan a los valores permitidos por las restricciones de PostgreSQL.
- No se crean archivos de migración ni se modifica `schema.sql`.
