# US52 — Filtros del historial de rentabilidad

US52 extiende el listado existente de US50; no agrega otra pantalla ni modifica el detalle o el contenido de los snapshots.

El endpoint existente `GET /api/finanzas/reportes-rentabilidad` acepta `fechaInicio` y `fechaFin`. Si ambos están vacíos, devuelve todos los reportes del comisionista autenticado. Si se informan, exige fechas ISO válidas, permite un rango de un día y rechaza el rango invertido o parcial. El filtro compara las columnas guardadas `periodo_desde` y `periodo_hasta`: incluye solo reportes cuyo período completo queda dentro del rango solicitado. No usa `generado_en` ni recalcula valores. Las consultas parametrizan las fechas y mantienen el filtro `usuario_id` del contexto autenticado; la paginación y el orden se conservan.

El listado valida el rango antes de consultar, conserva filtros editables hasta presionar **Filtrar**, limpia ambos campos con **Limpiar filtros**, y distingue entre historial vacío y ningún resultado para el rango seleccionado. Durante la consulta oculta los resultados anteriores.

Pruebas unitarias: `npm run test:reportes-filtros` en backend y `npm run test:reportes-rentabilidad` en frontend. Las pruebas de integración que consultan PostgreSQL no forman parte de esos comandos.
