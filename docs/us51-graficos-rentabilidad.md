# US51 — Gráficos de rentabilidad

La pantalla `/graficos-rentabilidad` está disponible únicamente para usuarios con rol `comisionista`. Los datos se consultan en el momento desde `ingresos`, `gastos`, `tipos_gasto` y `viajes`; no se leen snapshots históricos de US49/US50 ni se modifica `schema.sql`.

## API

- `GET /api/finanzas/graficos-rentabilidad/periodos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&agrupacion=dia|semana|mes`
- `GET /api/finanzas/graficos-rentabilidad/viajes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`

Ambas rutas requieren autenticación y rol `comisionista`. La identidad se obtiene de `req.usuario.id`; no aceptan un usuario indicado por el cliente. Los rangos incluyen ambos días extremos. La primera ruta devuelve solo períodos con movimientos para no crear datos de períodos vacíos.

Los ingresos cuentan si `estado = 'activo'`; los gastos cuentan si existen como filas de `gastos` y su tipo pertenece al mismo usuario. Ambas fuentes se agregan por separado y luego se combinan, evitando duplicar importes mediante JOINs. El resultado se calcula como ingresos menos gastos con la misma suma decimal de centavos que se usa en US49/US50.

En la vista por viaje se listan viajes `finalizado` con fecha dentro del rango. Solo se atribuyen movimientos con `viaje_id` coincidente, usuario propietario coincidente y fecha de movimiento dentro del rango seleccionado. Los viajes sin movimientos se muestran con totales cero. Los movimientos con `viaje_id IS NULL` se presentan aparte como generales; nunca se prorratean o asignan a un viaje. Movimientos asociados a viajes no finalizados no aparecen en el desglose por viaje, aunque sí pueden aparecer en la agregación temporal.

La UI usa SVG nativo con barras agrupadas, etiquetas y tooltips, sin agregar dependencias de gráficos. Las tablas muestran los mismos valores numéricos que entrega el backend para la visualización. Un debounce corto y un contador de solicitudes descartan resultados viejos cuando los filtros cambian rápidamente.

## Diferencia frente a US49/US50

US49/US50 conservan reportes inmutables calculados al momento de emitirlos. US51 representa los movimientos actuales y por eso puede variar cuando se modifica o anula un ingreso/gasto. No actualiza ni reemplaza snapshots anteriores.

## Pruebas

`npm run test:graficos-rentabilidad` valida fechas, agrupaciones permitidas y clasificación con precisión decimal. La consulta de PostgreSQL, el middleware de rol y las vistas se verifican indirectamente en revisión/build; las pruebas unitarias no hacen escrituras en la base local.
