# Épica 7: Administración de Gastos (US40 a US48)

ABMC sin estados: la baja **elimina** el registro. Todo es privado de cada comisionista (rol `comisionista`).
El **tipo de gasto es el concepto** del gasto: cada gasto se registra eligiendo un tipo.
La estructura de estas tablas está definida en `backend/db/schema.sql`.
Pantalla: menú **Gastos** (pestañas *Gastos* y *Tipos de gasto*). Tests: `npm --prefix backend run test:gastos`.

| US | Qué hace | Endpoint (`/api/finanzas`) |
|----|----------|----------------------------|
| US40 | Registrar gasto (tipo de gasto, monto > 0 con 2 decimales, fecha no futura, descripción opcional) | `POST /gastos` |
| US41 | Modificar gasto | `PUT /gastos/:id` |
| US42 | Eliminar gasto | `DELETE /gastos/:id` |
| US43 | Consultar gastos con filtros `desde`, `hasta`, `tipo`, `q` y total exacto | `GET /gastos`, `GET /gastos/:id` |
| US44 | Asociar un gasto a otro tipo de gasto (también desde la tabla) | `PATCH /gastos/:id/tipo` |
| US45 | Registrar tipo de gasto (nombre único por comisionista, sin distinguir mayúsculas) | `POST /tipos-gasto` |
| US46 | Modificar tipo de gasto; los gastos asociados siguen vinculados | `PUT /tipos-gasto/:id` |
| US47 | Consultar tipos (filtro `q`) con cantidad de gastos | `GET /tipos-gasto`, `GET /tipos-gasto/:id` |
| US48 | Eliminar tipo de gasto (no se puede si tiene gastos asociados) | `DELETE /tipos-gasto/:id` |

Errores: 400 datos inválidos (`{ errores: [...] }` o `{ mensaje }`), 404 no existe o es de otro usuario, 409 nombre repetido o tipo con gastos.
