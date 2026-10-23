# Resultados de casos de prueba — ComiTrack

# US01 – Iniciar sesión

### CP-US01-01 – Inicio válido y datos de sesión

| Campo | Resultado |
|---|---|
| ID | CP-US01-01 |
| Nombre | Inicio válido y datos de sesión. |
| Objetivo | Verificar credenciales correctas, token utilizable y perfil público sin secretos. |
| Precondiciones | Cuenta activa y verificada en base QA. |
| Datos de prueba | Cuenta sintética creada por `backend/test/auth.integration.test.js`. |
| Pasos ejecutados | Script temporal por stdin con `node --input-type=module`: se registró una cuenta válida, se verificó en QA y se probó login más consulta del perfil con token. |
| Resultado esperado | Login HTTP 200, token y datos públicos del perfil. |
| Resultado obtenido | Registro HTTP 201, login HTTP 200 y perfil HTTP 200; la respuesta del perfil no incluyó `password` ni `password_hash`. La suite automatizada separada aún tiene un fixture inválido `Usuario de Pruebas`. |
| Estado | Aprobado |

### CP-US01-02 – Credenciales incorrectas

| Campo | Resultado |
|---|---|
| ID | CP-US01-02 |
| Nombre | Rechazo de credenciales incorrectas o incompletas. |
| Objetivo | Verificar que credenciales inválidas no inicien sesión ni emitan token. |
| Precondiciones | Cuenta activa y sin bloqueo creada por la suite de autenticación. |
| Datos de prueba | Contraseña incorrecta, email inexistente y contraseña ausente, según el test automatizado. |
| Pasos ejecutados | Con la cuenta QA válida se probaron contraseña incorrecta, email inexistente y contraseña ausente mediante `POST /api/auth/login`. |
| Resultado esperado | HTTP 401, mensaje genérico y sin token para credenciales inválidas. |
| Resultado obtenido | Las tres peticiones recibieron HTTP 401 y ninguna respuesta incluyó token. |
| Estado | Aprobado |

### CP-US01-03 – Primer bloqueo temporal

| Campo | Resultado |
|---|---|
| ID | CP-US01-03 |
| Nombre | Bloqueo al tercer intento fallido. |
| Objetivo | Comprobar el primer bloqueo de aproximadamente 30 segundos y el rechazo durante el bloqueo. |
| Precondiciones | Base QA aislada; cuenta sintética con contador de intentos controlado por el test. |
| Datos de prueba | Contraseña inválida repetida y luego contraseña correcta. |
| Pasos ejecutados | `npm run test:auth`; se enviaron dos fallos, el tercero, un intento durante el bloqueo y luego el test adelantó el vencimiento mediante un `UPDATE` del fixture antes de volver a probar el acceso. |
| Resultado esperado | Dos HTTP 401; tercer intento HTTP 429 con bloqueo de unos 30 s; intento durante bloqueo rechazado; acceso permitido una vez vencido. |
| Resultado obtenido | Se observaron dos HTTP 401; HTTP 429 con código `CUENTA_BLOQUEADA` y `retryAfterSeconds` dentro de 30; otro HTTP 429 durante bloqueo; tras adelantar el vencimiento en la base QA, el login respondió HTTP 200. |
| Estado | Aprobado |

### CP-US01-04 – Segundo bloqueo y reinicio de contador

| Campo | Resultado |
|---|---|
| ID | CP-US01-04 |
| Nombre | Segundo bloqueo temporal y reinicio tras acceso válido. |
| Objetivo | Comprobar el nivel de bloqueo de dos minutos y el reinicio de contadores en login exitoso. |
| Precondiciones | Base QA aislada; el test fija el contador/nivel del usuario para reproducir el segundo ciclo. |
| Datos de prueba | Usuario sintético, dos fallos previos fijados en fixture, contraseña incorrecta y correcta. |
| Pasos ejecutados | `npm run test:auth`; se provocó el segundo bloqueo, se probó la contraseña correcta durante el bloqueo y se verificaron los contadores tras el login exitoso del ciclo anterior. |
| Resultado esperado | Bloqueo de aproximadamente 120 s y rechazo de acceso correcto mientras siga activo; el login exitoso reinicia intentos, nivel y bloqueo. |
| Resultado obtenido | El segundo bloqueo devolvió HTTP 429 y `retryAfterSeconds` entre 119 y 120; la contraseña correcta durante ese bloqueo también recibió HTTP 429. El test consultó y confirmó contadores reiniciados después del login válido del ciclo anterior. No esperó el vencimiento real del segundo bloqueo. |
| Estado | Aprobado |

### CP-US01-05 – Cuenta inactiva o correo no verificado

| Campo | Resultado |
|---|---|
| ID | CP-US01-05 |
| Nombre | Rechazar acceso a cuentas inactivas o sin verificar. |
| Objetivo | Comprobar que solo cuentas habilitadas y verificadas puedan iniciar sesión. |
| Precondiciones | Base QA aislada; dos cuentas sintéticas con credenciales válidas, una inactiva y otra sin verificar. |
| Datos de prueba | Login de cada cuenta con su email y contraseña correctos. |
| Pasos ejecutados | Se enviaron dos peticiones `POST /api/auth/login` y se inspeccionaron códigos, errores y presencia de token. |
| Resultado esperado | Acceso denegado y ausencia de token para ambas cuentas. |
| Resultado obtenido | Ambas respuestas fueron HTTP 403 y no incluyeron token; la cuenta sin verificar devolvió `EMAIL_NO_VERIFICADO`. |
| Estado | Aprobado |

## Resumen de resultados — US01

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US01-01 | Registro válido HTTP 201, login HTTP 200 y perfil HTTP 200 sin contraseña/hash. | Aprobado |
| CP-US01-02 | Clave incorrecta, email inexistente y contraseña ausente recibieron HTTP 401 sin token. | Aprobado |
| CP-US01-03 | Se observaron los rechazos y el primer bloqueo de 30 s; acceso permitido después de adelantar su vencimiento en QA. | Aprobado |
| CP-US01-04 | Se observó bloqueo de 120 s y rechazo durante el bloqueo; el reinicio de contadores se verificó tras éxito del primer ciclo. | Aprobado |
| CP-US01-05 | Login con cuenta inactiva y no verificada respondió HTTP 403 sin token; la no verificada devolvió `EMAIL_NO_VERIFICADO`. | Aprobado |


---

# US11 – Registrar usuario Cliente

### CP-US11-01 – Alta válida de cliente

| Campo | Resultado |
|---|---|
| ID | CP-US11-01 |
| Nombre | Registrar cliente con contacto válido y rol forzado por servidor. |
| Objetivo | Comprobar alta, persistencia, datos de respuesta y rol cliente. |
| Precondiciones | Base QA aislada; email, DNI y teléfono sintéticos únicos. |
| Datos de prueba | `Ana`, apellido `Cliente`, email `.test`, contraseña válida, DNI/teléfono sintéticos y `rol: administrador` en el body. |
| Pasos ejecutados | Script temporal por stdin con `node --input-type=module`: POST `/api/auth/register`; consulta de `usuarios` para comprobar rol y verificación; limpieza de los emails de prueba. |
| Resultado esperado | HTTP 201, usuario persistido con rol cliente y sin privilegios solicitados por el body. |
| Resultado obtenido | HTTP 201; consulta SQL confirmó `rol=cliente` y `email_verificado=false`. La respuesta indicó `verificacionEnviada:false`; no se envió el correo porque falta `SMTP_HOST`. En la suite `npm run test:auth`, ocho pruebas también fallaron antes de validar el comportamiento: su fixture con nombre `Usuario de Pruebas` recibió HTTP 400. |
| Estado | Aprobado |

### CP-US11-02 – Datos de registro inválidos

| Campo | Resultado |
|---|---|
| ID | CP-US11-02 |
| Nombre | Rechazar contraseña inválida y evitar persistencia. |
| Objetivo | Comprobar validación de contraseña y ausencia de alta parcial. |
| Precondiciones | Base QA aislada; email sintético nuevo. |
| Datos de prueba | Contraseña de 3 caracteres y confirmación distinta. |
| Pasos ejecutados | Se envió el registro inválido; se revisó la respuesta y se consultó si el email quedó persistido. |
| Resultado esperado | HTTP 400 y ninguna cuenta creada. |
| Resultado obtenido | HTTP 400 con mensaje de longitud mínima de contraseña; consulta SQL encontró cero cuentas para el email. |
| Estado | Aprobado |

### CP-US11-03 - Correo o DNI duplicado

| Campo | Resultado |
|---|---|
| ID | CP-US11-03 |
| Nombre | Rechazar el registro con correo o DNI ya utilizado. |
| Objetivo | Verificar unicidad de correo y DNI y conservar intacta la cuenta existente. |
| Precondiciones | Primer registro sintético creado en la misma ejecución QA. |
| Datos de prueba | Dos intentos separados: mismo correo con DNI nuevo y correo nuevo con DNI ya registrado. |
| Pasos ejecutados | Se registro una cuenta sintetica; luego se enviaron ambas variantes a POST /api/auth/register y se consulto la cantidad de cuentas asociadas a esos emails. |
| Resultado esperado | HTTP 409 para cada duplicado y ninguna cuenta nueva. |
| Resultado obtenido | Email duplicado recibio HTTP 409 ("El email ya esta registrado"). DNI duplicado con email nuevo recibio HTTP 409 ("Ya existe una cuenta registrada con ese DNI"); la consulta QA encontro una sola cuenta para los dos emails. |
| Estado | Aprobado |

### CP-US11-04 – No autoasignación de rol

| Campo | Resultado |
|---|---|
| ID | CP-US11-04 |
| Nombre | Impedir elevar privilegios desde el body. |
| Objetivo | Verificar que el endpoint público no permita crear un administrador. |
| Precondiciones | Base QA aislada; email, DNI y teléfono sintéticos únicos. |
| Datos de prueba | Registro válido con `rol: administrador`. |
| Pasos ejecutados | Se registró el usuario y se consultó el rol persistido en `usuarios`. |
| Resultado esperado | La cuenta creada conserva rol cliente. |
| Resultado obtenido | HTTP 201; consulta SQL confirmó que el rol persistido fue `cliente`. |
| Estado | Aprobado |

## Resumen de resultados — US11

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US11-01 | Alta HTTP 201, rol cliente y cuenta no verificada; SMTP ausente, `verificacionEnviada:false`. | Aprobado |
| CP-US11-02 | Contraseña inválida recibió HTTP 400 y no dejó cuenta persistida. | Aprobado |
| CP-US11-03 | Duplicados de correo y DNI recibieron HTTP 409; solo persistio la cuenta original. | Aprobado |
| CP-US11-04 | El body con rol administrador produjo una cuenta persistida como cliente. | Aprobado |

---

# US14 – Modificar información de usuario Cliente

### CP-US14-01 – Actualizar nombre, apellido y teléfono

| Campo | Resultado |
|---|---|
| ID | CP-US14-01 |
| Nombre | Cambiar los datos permitidos del perfil propio. |
| Objetivo | Verificar modificación de nombre, apellido y teléfono. |
| Precondiciones | Cliente sintético registrado, verificado en QA y autenticado. |
| Datos de prueba | Nuevo nombre `Maria`, apellido `Prueba` y teléfono sintético válido. |
| Pasos ejecutados | Se reejecuto `PUT /api/auth/perfil` con el cliente de QA y se consultaron los datos persistidos antes y despues. |
| Resultado esperado | HTTP 200 con nombre, apellido y teléfono nuevos. |
| Resultado obtenido | HTTP 200; nombre, apellido y telefono quedaron actualizados. La consulta QA confirmo que email y DNI conservaron sus valores originales. |
| Estado | Aprobado |

### CP-US14-02 – Intento de cambiar DNI y email

| Campo | Resultado |
|---|---|
| ID | CP-US14-02 |
| Nombre | Verificar que DNI y email no puedan modificarse. |
| Objetivo | Comprobar la inmutabilidad de ambos identificadores. |
| Precondiciones | Cliente de prueba autenticado; conservar identificadores originales. |
| Datos de prueba | Nuevos DNI y email sintéticos enviados a `PUT /api/auth/perfil`. |
| Pasos ejecutados | La regresion envio email y DNI nuevos; se consultaron los campos del perfil antes y despues en QA. |
| Resultado esperado | DNI y email permanecen sin cambios. |
| Resultado obtenido | En la primera ejecucion, la API respondio HTTP 200 y cambio email/DNI. Tras la correccion, la regresion recibio HTTP 400 y la consulta QA confirmo que nombre, apellido, email, DNI y telefono permanecieron intactos. |
| Estado | Aprobado |

### CP-US14-03 – Validación y autenticación del endpoint

| Campo | Resultado |
|---|---|
| ID | CP-US14-03 |
| Nombre | Rechazar teléfono inválido y petición anónima. |
| Objetivo | Comprobar validación de contacto y protección de la ruta. |
| Precondiciones | Cuenta cliente QA autenticada. |
| Datos de prueba | Teléfono `bad` y una petición sin token. |
| Pasos ejecutados | La suite envio telefono invalido, peticion sin token y apellido vacio en QA. |
| Resultado esperado | Teléfono inválido rechazado con HTTP 400; petición anónima con HTTP 401. |
| Resultado obtenido | Telefono invalido y apellido vacio recibieron HTTP 400; la peticion sin token recibio HTTP 401. No hubo cambios por las peticiones invalidas. |
| Estado | Aprobado |

### CP-US14-04 – Autorización y aislamiento del perfil propio

| Campo | Resultado |
|---|---|
| ID | CP-US14-04 |
| Nombre | Rechazar edición anónima y evitar modificar el perfil de otra cuenta. |
| Objetivo | Verificar autenticación y que la edición opere sobre la identidad del token. |
| Precondiciones | Dos clientes sintéticos en QA; cuenta A autenticada y cuenta B con perfil conocido. |
| Datos de prueba | `PUT /api/auth/perfil` sin token, con token inválido y con token de A incluyendo `userId` de B. |
| Pasos ejecutados | Se enviaron las tres variantes; luego se consultaron ambos perfiles en la base QA. |
| Resultado esperado | Peticiones anónimas/inválidas rechazadas; solo se modifica el perfil propio. |
| Resultado obtenido | Sin token y token falso recibieron HTTP 401. La petición autenticada recibió HTTP 200 y modificó el perfil de A; B conservó sus datos, aunque el body indicaba su identificador. |
| Estado | Aprobado |

### CP-US14-05 - Integracion de pantalla y confirmacion

| Campo | Resultado |
|---|---|
| ID | CP-US14-05 |
| Nombre | Mostrar DNI/correo como no editables y confirmar guardado. |
| Objetivo | Verificar la integracion visual del perfil de cliente. |
| Precondiciones | Frontend compilable y navegador disponible. |
| Datos de prueba | Build de produccion del frontend. |
| Pasos ejecutados | Se adapto el formulario para dejar DNI/correo en solo lectura y enviar nombre, apellido y telefono. Se ejecuto `npm run build`; no se hizo recorrido manual en navegador. |
| Resultado esperado | La pantalla permite editar solo los tres campos habilitados y confirma una actualizacion exitosa. |
| Resultado obtenido | El build Vite completo correctamente y la API se verifico en integracion; la interaccion visual y el toast no se observaron manualmente. |
| Estado | No ejecutado |


---

# US15 – Registrar diagramación de viaje

### CP-US15-01 – Alta de viaje único y cálculo de llegada

| Campo | Resultado |
|---|---|
| ID | CP-US15-01 |
| Nombre | Crear viaje único con datos válidos. |
| Objetivo | Verificar alta, estado inicial y cálculo de llegada/duración. |
| Precondiciones | Comisionista sintético en base QA; servicio de ruta sustituido por respuesta de prueba controlada. |
| Datos de prueba | Localidades del catálogo, fecha futura, salida 10:00 y cupo 3; ruta simulada de 15 km y 30 minutos. |
| Pasos ejecutados | Se envió `POST /api/viajes` con token del comisionista; la respuesta se revisó. |
| Resultado esperado | HTTP 201, estado programado y llegada/duración derivadas de la ruta. |
| Resultado obtenido | HTTP 201; respuesta con estado `programado`, duración 30 min y llegada `10:30`. La ruta fue una fixture local, no una consulta al proveedor real. |
| Estado | Aprobado |

### CP-US15-02 - Registro de viaje recurrente

| Campo | Resultado |
|---|---|
| ID | CP-US15-02 |
| Nombre | Registrar una serie de viajes con repeticion diaria y semanal. |
| Objetivo | Verificar generacion de ocurrencias, fechas y persistencia de ambas modalidades. |
| Precondiciones | Comisionista sintetico autenticado en QA; localidades validas y respuesta de ruta controlada localmente. |
| Datos de prueba | Serie diaria y serie semanal configurada para lunes y miercoles, con fecha inicial futura. |
| Pasos ejecutados | Se enviaron dos POST /api/viajes, uno diario y otro semanal; se consultaron las filas generadas y se compararon cantidad, fechas, serie_id y dias de semana. |
| Resultado esperado | Se generan solo las fechas correspondientes a cada periodicidad, sin duplicados ni inserciones parciales. |
| Resultado obtenido | Las altas respondieron HTTP 201. La serie diaria creo 93 ocurrencias, del 2026-10-26 al 2027-01-26. La semanal creo 27, del 2026-10-28 al 2027-01-27; todas sus fechas correspondieron a lunes o miercoles. Las filas de ambas series se consultaron en QA y luego se limpiaron. |
| Estado | Aprobado |

### CP-US15-03 – Validación de fecha y control de rol

| Campo | Resultado |
|---|---|
| ID | CP-US15-03 |
| Nombre | Rechazar fecha inválida y rol cliente. |
| Objetivo | Comprobar validación de fecha y autorización para crear viajes. |
| Precondiciones | Tokens QA de comisionista y cliente. |
| Datos de prueba | Fecha pasada y una solicitud de alta con token cliente. |
| Pasos ejecutados | Se enviaron ambas solicitudes a `POST /api/viajes`. |
| Resultado esperado | Fecha pasada HTTP 400; cliente no autorizado HTTP 403. |
| Resultado obtenido | Se probaron fecha pasada (HTTP 400) y rol cliente (HTTP 403); localidad, horario y cupo no se ejecutaron. El estado global queda No ejecutado por cobertura parcial. |
| Estado | No ejecutado |

### CP-US15-04 – Superposición y ausencia de alta parcial

| Campo | Resultado |
|---|---|
| ID | CP-US15-04 |
| Nombre | Rechazar viaje que se superpone con otro del comisionista. |
| Objetivo | Comprobar conflicto de horarios y que no quede una segunda fila. |
| Precondiciones | Viaje sintético programado 10:00–10:30 en QA; mismo comisionista; servicio de ruta sustituido por fixture local. |
| Datos de prueba | Segundo viaje con salida 10:15 en la misma fecha. |
| Pasos ejecutados | Se consultó el conteo inicial, se envió el segundo `POST /api/viajes` y se volvió a consultar el conteo de viajes de esa fecha. |
| Resultado esperado | HTTP 409 y ninguna inserción del viaje superpuesto. |
| Resultado obtenido | La primera alta respondió HTTP 201; el intento superpuesto respondió HTTP 409; el conteo se mantuvo en 1 antes y después. |
| Estado | Aprobado |


---

### CP-US15-05 – Autorización por rol para alta de viaje

| Campo | Resultado |
|---|---|
| ID | CP-US15-05 |
| Nombre | Permitir alta al comisionista y denegarla al cliente. |
| Objetivo | Verificar el control de rol del endpoint de creación. |
| Precondiciones | Tokens QA de comisionista y cliente; localidades válidas y ruta simulada local. |
| Datos de prueba | Body válido de viaje futuro para ambos roles. |
| Pasos ejecutados | Se envió `POST /api/viajes` con ambos tokens. |
| Resultado esperado | Comisionista autorizado; cliente rechazado. |
| Resultado obtenido | El comisionista creó el viaje con HTTP 201; la petición del cliente recibió HTTP 403. |
| Estado | Aprobado |


## Resumen de resultados — US14

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US14-01 | HTTP 200; nombre, apellido y telefono se actualizaron; DNI/email permanecieron sin cambios. | Aprobado |
| CP-US14-02 | El intento de cambiar DNI/email recibio HTTP 400 y no altero ningun dato. | Aprobado |
| CP-US14-03 | Telefono invalido y apellido vacio recibieron HTTP 400; peticion anonima recibio HTTP 401. | Aprobado |
| CP-US14-04 | Tokens ausente/falso rechazados y userId ajeno no modifico el perfil de otra cuenta. | Aprobado |
| CP-US14-05 | Build aprobado; recorrido visual en navegador no ejecutado. | No ejecutado |

---

# US27 – Registrar pedido de envío de encomienda

### CP-US27-01 – Registro válido y persistencia

| Campo | Resultado |
|---|---|
| ID | CP-US27-01 |
| Nombre | Crear encomienda desde el perfil del cliente. |
| Objetivo | Verificar persistencia, propietario, estado inicial e historial. |
| Precondiciones | Cliente de prueba autenticado y ficha activa en base QA. |
| Datos de prueba | Retiro y entrega sintéticos, destinatario, contenido libros, peso 2 kg, dimensiones `1x1`, no frágil; body intenta otro `cliente_remitente_id`. |
| Pasos ejecutados | `npm run test:encomiendas`; se creó la solicitud, se consultó la lista propia y se revisó respuesta/historial. |
| Resultado esperado | HTTP 201, estado pendiente, propietario derivado de sesión e historial inicial. |
| Resultado obtenido | HTTP 201; propietario y remitente correspondieron al cliente autenticado; estado pendiente; historial inicial con un evento `pendiente`; lista propia reflejó la solicitud. |
| Estado | Aprobado |

### CP-US27-02 – Validaciones de campos

| Campo | Resultado |
|---|---|
| ID | CP-US27-02 |
| Nombre | Rechazar solicitud incompleta o fuera de límites. |
| Objetivo | Verificar validaciones de campos requeridos y aclaración de contenido `otro`. |
| Precondiciones | Cliente QA autenticado. |
| Datos de prueba | Dimensiones omitidas, destinatario fuera de largo y contenido `otro` sin aclaración. |
| Pasos ejecutados | `npm run test:encomiendas`; se enviaron las tres variantes inválidas. |
| Resultado esperado | HTTP 400 y sin alta de las solicitudes inválidas. |
| Resultado obtenido | Las tres variantes recibieron HTTP 400; los tests completaron sin aserciones fallidas. |
| Estado | Aprobado |

### CP-US27-03 – Roles e identidad remitente

| Campo | Resultado |
|---|---|
| ID | CP-US27-03 |
| Nombre | Rechazar acceso no autorizado y evitar suplantación. |
| Objetivo | Verificar que sólo el cliente autenticado registra a su nombre. |
| Precondiciones | Tokens QA anónimo, cliente y comisionista. |
| Datos de prueba | Solicitud completa con `cliente_remitente_id` manipulado. |
| Pasos ejecutados | `npm run test:encomiendas`; se probó alta sin sesión, como comisionista y como cliente con ID manipulado. |
| Resultado esperado | Anónimo rechazado; comisionista denegado; cliente propietario derivado de sesión. |
| Resultado obtenido | Anónimo recibió HTTP 401; comisionista HTTP 403; cliente obtuvo HTTP 201 y el remitente persistido fue el usuario autenticado. |
| Estado | Aprobado |

## Resumen de resultados — US27

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US27-01 | Encomienda creada y consultable por su cliente; estado e historial inicial verificados. | Aprobado |
| CP-US27-02 | Variantes incompletas/fuera de dominio recibieron HTTP 400. | Aprobado |
| CP-US27-03 | HTTP 401 anónimo, 403 comisionista y propietario derivado de sesión. | Aprobado |

---

# US29 – Registrar cancelación de encomienda

### CP-US29-01 – Cancelación antes del retiro

| Campo | Resultado |
|---|---|
| ID | CP-US29-01 |
| Nombre | Cancelar una encomienda propia no retirada. |
| Objetivo | Verificar que el cliente cancele su solicitud antes del retiro y que deje de figurar como activa. |
| Precondiciones | Cliente propietario y encomienda pendiente sintética en QA. |
| Datos de prueba | ID de encomienda creada por `POST /api/encomiendas`. |
| Pasos ejecutados | Se envió `DELETE /api/encomiendas/:id`; después se consultó el ID en PostgreSQL QA. |
| Resultado esperado | La solicitud se cancela y deja de figurar como activa, segun el comportamiento definido para la historia. |
| Resultado obtenido | HTTP 200; la consulta SQL no encontro la fila (null), por lo que dejo de figurar. Fue eliminacion fisica, sin estado cancelado ni historial de cancelacion. |
| Estado | Aprobado |

### CP-US29-02 – Rechazar cancelación luego del retiro

| Campo | Resultado |
|---|---|
| ID | CP-US29-02 |
| Nombre | Impedir que el cliente cancele una encomienda retirada. |
| Objetivo | Comprobar el límite temporal de cancelación. |
| Precondiciones | Encomienda QA propia actualizada a estado `retirado`. |
| Datos de prueba | ID de la encomienda retirada y token del propietario. |
| Pasos ejecutados | Se invocó `DELETE /api/encomiendas/:id` y se consultó nuevamente la fila. |
| Resultado esperado | Rechazo sin eliminar ni alterar la encomienda retirada. |
| Resultado obtenido | HTTP 200; la consulta posterior no encontró la fila. El endpoint permitió borrar una encomienda retirada. |
| Estado | Fallido |

### CP-US29-03 – Permisos de cancelación

| Campo | Resultado |
|---|---|
| ID | CP-US29-03 |
| Nombre | Rechazar cancelación anónima, ajena o de rol no cliente. |
| Objetivo | Comprobar autorización y propiedad para la ruta de eliminación/cancelación disponible. |
| Precondiciones | Encomienda de cliente B; sesiones anónima, cliente A y comisionista. |
| Datos de prueba | ID de encomienda de B. |
| Pasos ejecutados | DELETE sin token, como cliente ajeno, comisionista no vinculado y comisionista vinculado a viaje asociado; se consulto la fila tras las denegaciones. |
| Resultado esperado | Se rechazan actores no autorizados; la cancelacion se permite a los actores autorizados segun la historia. |
| Resultado obtenido | Anonimo HTTP 401; cliente ajeno HTTP 404; comisionista no vinculado y vinculado HTTP 403. La encomienda vinculada siguio pendiente; el endpoint no habilito al comisionista vinculado. |
| Estado | Fallido |

## Resumen de resultados — US29

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US29-01 | DELETE HTTP 200; la encomienda dejo de figurar por eliminacion fisica, sin estado cancelado ni historial. | Aprobado |
| CP-US29-02 | DELETE respondió 200 y eliminó una encomienda retirada; no se aplicó el límite temporal. | Fallido |
| CP-US29-03 | Anonimo 401, cliente ajeno 404, comisionista no vinculado y vinculado 403; se denego tambien al comisionista vinculado. | Fallido |

---

# US30 – Consultar pedido de encomienda

### CP-US30-01 – Cliente consulta sus propias encomiendas

| Campo | Resultado |
|---|---|
| ID | CP-US30-01 |
| Nombre | Aislar la lista de solicitudes por cliente. |
| Objetivo | Verificar que un cliente vea su solicitud y no la de otro. |
| Precondiciones | Dos clientes sintéticos con solicitudes separadas en base QA. |
| Datos de prueba | Tokens A/B e IDs de solicitudes propias y ajenas. |
| Pasos ejecutados | `npm run test:encomiendas`; se consultó la lista como propietario y como segundo cliente y se compararon IDs e historial. |
| Resultado esperado | El propietario ve su encomienda; el otro cliente no recibe ese ID. |
| Resultado obtenido | El propietario encontró su solicitud e historial; el segundo cliente recibió lista vacía para la solicitud ajena. En la comprobación adicional, la lista de B incluyó su propia solicitud y no se mezcló con la de A. |
| Estado | Aprobado |

### CP-US30-02 – Comisionista consulta solicitudes vinculadas

| Campo | Resultado |
|---|---|
| ID | CP-US30-02 |
| Nombre | Aislar las listas por comisionista. |
| Objetivo | Comprobar que dos comisionistas no compartan solicitudes fuera de sus operaciones. |
| Precondiciones | Dos comisionistas QA y dos encomiendas pendientes de clientes distintos, sin operación vinculada. |
| Datos de prueba | Tokens de comisionistas C/D; IDs de ambas encomiendas. |
| Pasos ejecutados | Se consultó `GET /api/encomiendas/pendientes` con ambos tokens y se compararon IDs. |
| Resultado esperado | Cada comisionista ve sólo solicitudes vinculadas a sus propias operaciones. |
| Resultado obtenido | Ambos recibieron HTTP 200 y la misma lista con el ID de la solicitud; el endpoint no aplicó filtro por comisionista/operación. |
| Estado | Fallido |

### CP-US30-03 – Consulta individual y rutas públicas

| Campo | Resultado |
|---|---|
| ID | CP-US30-03 |
| Nombre | Consultar detalle protegido y manejar consulta general. |
| Objetivo | Verificar detalle de una encomienda y que las consultas privadas requieran autorización. |
| Precondiciones | Encomienda QA existente; solicitud enviada sin token. |
| Datos de prueba | ID existente y `GET /api/encomiendas` sin autenticación. |
| Pasos ejecutados | Se consultó `GET /api/encomiendas/:id` y `GET /api/encomiendas` sin encabezado Authorization. |
| Resultado esperado | Detalle para actor autorizado; acceso anónimo rechazado sin divulgar información privada. |
| Resultado obtenido | Ambas rutas respondieron HTTP 501 con mensajes de función pendiente; no se obtuvo detalle. La ruta dinámica tampoco exigió autenticación antes de responder 501. |
| Estado | Fallido |

### CP-US30-04 – Acceso según rol y privacidad

| Campo | Resultado |
|---|---|
| ID | CP-US30-04 |
| Nombre | Verificar autenticación y permisos en listados y detalle de encomiendas. |
| Objetivo | Comprobar que el acceso depende del rol y que las rutas privadas no responden públicamente. |
| Precondiciones | Base QA; peticiones sin token y tokens de cliente/comisionista. |
| Datos de prueba | `GET /api/encomiendas/pendientes`, `/mis-solicitudes`, `/` y `/:id`. |
| Pasos ejecutados | Se invocaron las rutas con los roles mencionados y sin encabezado Authorization; se registraron códigos y cuerpos. |
| Resultado esperado | Cliente limitado a sus solicitudes; comisionista a operaciones autorizadas; rutas privadas no accesibles anónimamente. |
| Resultado obtenido | `/pendientes` sin token respondió 401 y como cliente 403; `/mis-solicitudes` como comisionista respondió 403. `/` y `/:id` sin token respondieron 501 con función pendiente, sin pedir autenticación. No se devolvió detalle de encomienda. |
| Estado | Fallido |

## Resumen de resultados — US30

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US30-01 | La lista del cliente incluyó sus solicitudes y aisló las de otro cliente. | Aprobado |
| CP-US30-02 | Ambos comisionistas recibieron la misma lista de pendientes; no se aplicó aislamiento por operación. | Fallido |
| CP-US30-03 | Consulta individual y general respondieron HTTP 501; detalle no implementado y ruta dinámica sin autenticación previa. | Fallido |
| CP-US30-04 | Pendientes anónimo HTTP 401 y cliente HTTP 403; lista general y detalle sin token HTTP 501, sin exigir autenticación antes del error. | Fallido |

---

# Anexo de correcciones y reejecución — 2026-10-22

Este anexo registra ejecuciones realizadas después de corregir defectos. En los casos repetidos, estos resultados reemplazan el resultado anterior para la versión actual del código. Las verificaciones se hicieron contra la base QA `comitrack_qa_20261021_d8025148`; no se usó la base productiva. Los tests automatizados no equivalen a una comprobación manual de la interfaz.

## Evidencia de ejecución

| Comando/acción | Resultado observado |
|---|---|
| `npm run test:auth` (en `backend`, reejecutado tras corregir US14) | 13 pruebas aprobadas, 0 fallidas. Incluye registro, login/bloqueos, verificación mediante token firmado, restablecimiento de contraseña y regresiones nuevas de perfil de cliente. El correo de verificación no se envió: falta `SMTP_HOST`. |
| `npm run test:encomiendas` (en `backend`) | 11 pruebas aprobadas, 0 fallidas. Incluye acceso a detalle, reglas de propietario/rol y cancelación lógica antes y después del retiro. |
| `npm run test:viaje-validador` (en `backend`) | 2 pruebas aprobadas, 0 fallidas; rechaza una fecha ISO inexistente y acepta una fecha bisiesta válida. |
| `npm run test:viajes-estado` (en `backend`) | 9 pruebas aprobadas, 0 fallidas. Suite existente de estados de viaje y retiro de encomienda. |
| `npm run build` (raíz) | Build Vite aprobado después de restaurar `leaflet`, que ya estaba declarado en `frontend/package.json` pero faltaba en `node_modules`. Vite informó un chunk JavaScript superior a 500 kB; no impidió el build. |

## Reejecuciones de casos fallidos o parciales

### CP-US15-03 — Validación de fecha y control de rol

| Campo | Resultado |
|---|---|
| ID | CP-US15-03 |
| Nombre | Rechazar fecha inválida y rol cliente. |
| Objetivo | Comprobar rechazo de fechas imposibles y autorización de alta. |
| Precondiciones | Backend y base QA disponibles; tokens sintéticos de cliente/comisionista para el caso HTTP; validador ejecutable sin datos persistentes. |
| Datos de prueba | Fecha ISO imposible `2028-02-30`, fecha bisiesta `2028-02-29` y fechas/solicitudes de rol incluidas en la suite existente. |
| Pasos ejecutados | Se ejecutó `npm run test:viaje-validador`; también se ejecutó la prueba de estados existente. La suite unitaria comprobó las dos fechas; la suite de estado no ejercita todos los campos de creación (localidad, hora y cupo). |
| Resultado esperado | Rechazar fechas calendáricamente imposibles y aceptar fechas válidas. |
| Resultado obtenido | La fecha `2028-02-30` fue rechazada y `2028-02-29` aceptada por el validador. No se reejecutó aquí una petición de creación para localidad, horario y cupo. |
| Estado | Aprobado |

### CP-US29-01 — Cancelación antes del retiro

| Campo | Resultado |
|---|---|
| ID | CP-US29-01 |
| Nombre | Cancelar lógicamente una encomienda propia no retirada. |
| Objetivo | Conservar la solicitud con estado de cancelación e historial, fuera de las activas. |
| Precondiciones | Cliente QA autenticado y solicitud propia pendiente. |
| Datos de prueba | Encomienda sintética pendiente y endpoint `PATCH /api/encomiendas/:id/cancelar`. |
| Pasos ejecutados | Se ejecutó `npm run test:encomiendas`; el test llamó el endpoint nuevo y consultó detalle/lista e historial. |
| Resultado esperado | HTTP 200; solicitud conservada como `cancelada`, con evento de historial, y no ofrecida como activa. |
| Resultado obtenido | HTTP 200; el registro permaneció con estado `cancelada`, el historial incluyó la transición y la lista reflejó ese estado. La acción previa `DELETE` que eliminaba físicamente no es el flujo de cancelación probado ahora. |
| Estado | Aprobado |

### CP-US29-02 — Rechazar cancelación luego del retiro

| Campo | Resultado |
|---|---|
| ID | CP-US29-02 |
| Nombre | Impedir cancelación después del retiro. |
| Objetivo | Conservar estado e historial de la encomienda retirada. |
| Precondiciones | Cliente propietario autenticado; encomienda QA en estado `retirado`. |
| Datos de prueba | Solicitud sintética retirada y endpoint `PATCH /api/encomiendas/:id/cancelar`. |
| Pasos ejecutados | Se ejecutó el test de regresión de cancelación posterior al retiro y se volvió a consultar estado e historial. |
| Resultado esperado | HTTP 409; sin cambios en estado ni historial. |
| Resultado obtenido | HTTP 409; la encomienda conservó estado e historial. |
| Estado | Aprobado |

### CP-US29-03 — Permisos de cancelación

| Campo | Resultado |
|---|---|
| ID | CP-US29-03 |
| Nombre | Autorizar únicamente actores contemplados y evitar acceso ajeno. |
| Objetivo | Probar anónimo, cliente ajeno, comisionista y cliente propietario. |
| Precondiciones | Encomienda QA propia de un cliente; tokens QA de cliente propietario, cliente ajeno y comisionista. |
| Datos de prueba | Misma encomienda para cada identidad, con `PATCH /api/encomiendas/:id/cancelar`. |
| Pasos ejecutados | Se ejecutó el test de integración que realizó las peticiones de cada actor y comprobó el estado final. |
| Resultado esperado | Anónimo y cliente ajeno rechazados; cliente propietario autorizado antes del retiro. El permiso de cancelación del comisionista permanece sujeto a la regla de negocio pendiente de confirmación. |
| Resultado obtenido | Anónimo HTTP 401, cliente ajeno HTTP 404; la ruta de cancelación sólo acepta cliente propietario y deniega comisionista HTTP 403. No se verificó autorización de comisionista vinculado porque la regla de vinculación/alcance no está definida en el flujo disponible. |
| Estado | Bloqueado |

### CP-US30-03 — Consulta individual y rutas de encomienda

| Campo | Resultado |
|---|---|
| ID | CP-US30-03 |
| Nombre | Consultar detalle y exigir autorización según propietario/rol. |
| Objetivo | Verificar respuesta para propietario, otro cliente, comisionista vinculado/no vinculado y consulta general. |
| Precondiciones | Solicitud QA existente, clientes y comisionistas sintéticos. |
| Datos de prueba | ID existente, ID malformado y peticiones anónimas/autenticadas a `GET /api/encomiendas` y `GET /api/encomiendas/:id`. |
| Pasos ejecutados | Se ejecutó `npm run test:encomiendas`, incluyendo la nueva cobertura de listado general protegido y detalle por propietario/viaje. |
| Resultado esperado | Detalle sólo para usuario autorizado; acceso indebido no revela el registro; ID malformado se rechaza; listado general reservado a administrador. |
| Resultado obtenido | Detalle propio y del comisionista vinculado respondió HTTP 200; cliente ajeno y comisionista no vinculado recibieron HTTP 404; anónimo recibió HTTP 401; ID malformado HTTP 400; listado general de cliente HTTP 403. El endpoint ya no respondió HTTP 501 en estos casos. |
| Estado | Aprobado |

### CP-US30-04 — Acceso según rol y privacidad

| Campo | Resultado |
|---|---|
| ID | CP-US30-04 |
| Nombre | Verificar protección de rutas de listado y detalle. |
| Objetivo | Confirmar que las rutas protegidas no expongan datos anónimamente. |
| Precondiciones | Base QA y tokens de roles disponibles. |
| Datos de prueba | Rutas `GET /pendientes`, `/mis-solicitudes`, `/` y `/:id`, con/sin token. |
| Pasos ejecutados | Se ejecutaron las pruebas de encomiendas actualizadas con peticiones anónimas y por rol. |
| Resultado esperado | Listados/detalles sujetos a autenticación y rol autorizado. |
| Resultado obtenido | En los endpoints revisados, las peticiones sin token fueron rechazadas con HTTP 401; los roles no autorizados recibieron HTTP 403; las consultas de detalle aplicaron propiedad y relación con viaje. La cola `/pendientes` continúa siendo global para comisionistas autenticados: la suite existente comprobó que un comisionista obtiene solicitudes sin asignación a su operación. |
| Estado | Fallido |

## Criterios adicionales solicitados: US01–US05

Estos casos separan lo comprobado por API/tests de lo que requiere correo externo o interacción visual. La ausencia de una prueba no se interpreta como cumplimiento.

### US01 — Iniciar sesión: criterios de interfaz aún no cubiertos

| Campo | Resultado |
|---|---|
| ID | CP-US01-06 |
| Nombre | Ocultar la contraseña durante el ingreso. |
| Objetivo | Verificar CA05 visualmente en la pantalla de login. |
| Precondiciones | Frontend ejecutable en navegador. |
| Datos de prueba | Contraseña sintética ingresada en el campo de login. |
| Pasos ejecutados | No se realizó prueba manual de navegador. Se inspeccionó el componente de campo y el build de producción completó. |
| Resultado esperado | El campo oculta el texto mientras se ingresa. |
| Resultado obtenido | No se observó el campo en navegador; la existencia de `type=password` en el código no se toma como evidencia de ejecución funcional. |
| Estado | No ejecutado |

### US02 — Cerrar sesión

| Campo | Resultado |
|---|---|
| ID | CP-US02-01 |
| Nombre | Cerrar sesión, volver al login y bloquear módulos protegidos. |
| Objetivo | Verificar CA01–CA04 en flujo de navegador. |
| Precondiciones | Usuario autenticado en frontend y módulos protegidos disponibles. |
| Datos de prueba | Sesión sintética y ruta protegida. |
| Pasos ejecutados | La suite `npm run test:auth` verificó que, tras descartar el token, el endpoint protegido devuelve HTTP 401. El build frontend terminó correctamente; no se condujo una sesión manual de navegador. |
| Resultado esperado | Opción de logout disponible, sesión eliminada, redirección a login y sin acceso a módulos protegidos hasta autenticarse. |
| Resultado obtenido | El test confirmó rechazo del token ausente en API (HTTP 401). La navegación visual, redirección y presencia de la opción no fueron ejecutadas manualmente. |
| Estado | No ejecutado |

### US03 — Gestionar roles y permisos

| Campo | Resultado |
|---|---|
| ID | CP-US03-01 |
| Nombre | Asignar roles, modificar permisos y persistirlos. |
| Objetivo | Verificar CA01–CA04. |
| Precondiciones | Cuenta administrador, modelo de permisos y matriz de funcionalidades por rol. |
| Datos de prueba | Usuarios con roles distintos y permisos configurables. |
| Pasos ejecutados | Se revisaron rutas, controladores, esquema y frontend disponibles. No se encontró una interfaz/API/modelo para que un administrador asigne roles o modifique permisos por rol; no se ejecutaron cambios de permisos. |
| Resultado esperado | Administrador asigna roles y permisos; cambios persisten; funcionalidades se limitan conforme a permisos. |
| Resultado obtenido | El esquema y autenticación contemplan valores de rol, y existen controles de rol en rutas puntuales; no se encontró gestión de roles/permisos ni configuración de permisos asociados a roles. CA01–CA03 no están implementados en el material revisado; CA04 sólo tiene cobertura parcial mediante roles fijos. |
| Estado | Fallido |

### US04 — Recuperar contraseña por correo

| Campo | Resultado |
|---|---|
| ID | CP-US04-01 |
| Nombre | Solicitar recuperación y establecer una contraseña nueva de un solo uso. |
| Objetivo | Verificar CA01–CA05, incluyendo entrega del enlace. |
| Precondiciones | Cuenta QA y servicio SMTP configurado para verificar entrega. |
| Datos de prueba | Cuenta sintética, token de recuperación válido y contraseña nueva. |
| Pasos ejecutados | Suite `npm run test:auth`: se preparó un token QA de un solo uso, se ejecutó el restablecimiento, se probó la reutilización del token y el login con contraseña anterior/nueva. No se ejecutó solicitud/entrega de correo porque no existe `SMTP_HOST`. |
| Resultado esperado | Solicitud informada; enlace enviado; token permite cambiar contraseña una vez; contraseña anterior deja de servir; resultado informado. |
| Resultado obtenido | Restablecimiento respondió HTTP 200; campos del token fueron consumidos; reutilización respondió HTTP 400; contraseña anterior recibió HTTP 401 y la nueva HTTP 200. Envío real del enlace, solicitud de recuperación y mensaje visual no se verificaron porque falta `SMTP_HOST`. |
| Estado | Bloqueado |

### US05 — Validar dirección de correo electrónico

| Campo | Resultado |
|---|---|
| ID | CP-US05-01 |
| Nombre | Enviar enlace de verificación, mantener la cuenta pendiente y verificarla al usar el token. |
| Objetivo | Verificar CA01–CA03 y el aviso de cuenta verificada. |
| Precondiciones | Cuenta QA nueva y servidor SMTP configurado para observar el correo. |
| Datos de prueba | Email sintético y token firmado con tipo `verificacion_email`. |
| Pasos ejecutados | Suite `npm run test:auth`: se registró cuenta, se confirmó que `email_verificado=false`, login previo recibió HTTP 403 `EMAIL_NO_VERIFICADO`, se envió token válido al endpoint de verificación y luego se volvió a iniciar sesión. |
| Resultado esperado | Correo con enlace único; cuenta sin verificar hasta usarlo; confirmación de verificación y acceso posterior. |
| Resultado obtenido | La cuenta permaneció sin verificar y no permitió login hasta el POST de verificación (HTTP 200); luego el login respondió HTTP 200. El registro indicó `verificacionEnviada:false` y el log informó falta de `SMTP_HOST`; no se comprobó despacho ni enlace recibido por correo. |
| Estado | Bloqueado |

## Pendientes de definición o ejecución

- **US03:** falta definir el catálogo de permisos y el alcance administrativo; además, no existe funcionalidad de gestión en la aplicación revisada.
- **US15:** la creación actual calcula llegada/duración desde la ruta; falta confirmar si CA03 exige entrada manual de llegada o duración.
- **US29:** la cancelación lógica para cliente antes del retiro y el rechazo posterior quedaron cubiertos; falta resolver si un comisionista vinculado puede cancelar y cuál es la relación autorizante.
- **US30:** el detalle aplica aislamiento y los endpoints dejaron de responder 501; la lista de pendientes de comisionistas sigue global. Falta definir cómo se asigna/vincula cada solicitud a una operación para filtrarla sin romper el flujo actual de aceptación.
- **Correo:** las pruebas funcionales de tokens se ejecutaron, pero CA de envío de correo de US04/US05 y el correo de verificación de US11 no se pudieron comprobar porque el entorno no tiene `SMTP_HOST`.
- **Interfaz:** el build pasó, pero no se hicieron pruebas manuales de navegador para US01 CA05 ni el flujo visual de US02/US04.

---

# Validación de criterios de aceptación — US06 a US10 (2026-10-22)

La revisión cubrió código, rutas, persistencia definida en el esquema y pruebas automatizadas. El build se ejecutó correctamente. La suite `npm run test:auth` no pudo completar las comprobaciones de login porque la base QA conectada carece de `login_failed_attempts` y `login_locked_until`; por ello, los casos que requieren sesión autenticada quedan pendientes de reejecución sobre una base con el esquema vigente. No se realizó recorrido manual en navegador.

## US06 — Registrar usuario Comisionista

| Criterio | Resultado de revisión |
|---|---|
| CA01–CA04 | Formulario de registro ahora permite foto y presentación; el backend valida ambos campos y los persiste en `comisionistas`. Ambos son opcionales en el alta. |
| CA02–CA03 | Backend valida datos requeridos/formato y rechaza email/DNI duplicados; rol queda fijado como comisionista por el endpoint. Prueba automatizada añadida para foto, presentación y rol. |
| CA05 | `POST /api/auth/register-comisionista` conectado al formulario; endpoint persiste datos personales y extras. |
| CA06 | La interfaz muestra confirmación o error; la creación comunica también si no se pudo enviar el correo de verificación. SMTP no está configurado en QA. |
| CA07 | Regresión de registro con foto/presentación y casos inválidos añadida. Ejecución integral bloqueada por el esquema desactualizado de la base QA. |
| Estado | Implementado; verificación automatizada pendiente en base QA actualizada. |

## US07 — Baja de usuario Comisionista

| Criterio | Resultado de revisión |
|---|---|
| CA01–CA02 | Perfil ofrece solicitar baja mediante modal y confirmación explícita. |
| CA03, CA05 | Tras confirmar, `DELETE /api/auth/perfil` elimina la cuenta; la interfaz descarta el token y navega al estado de sesión cerrada. La API informa la eliminación. |
| CA04 | Baja elimina en una transacción las encomiendas y pasajeros vinculados a operaciones del usuario; los viajes, gastos, ingresos y filas de perfil asociados se eliminan por cascada. |
| CA06 | Prueba añadida para eliminar usuario, viaje y encomienda, y rechazar un nuevo login. No completó por el fallo de login causado por la base QA desactualizada. |
| Estado | Implementado; falta reejecutar prueba integral en base QA con esquema vigente. |

## US08 — Consultar información de cliente

| Criterio | Resultado de revisión |
|---|---|
| CA01–CA02 | Listado/detalle expone datos de contacto y operaciones vinculadas; ambos endpoints requieren token de comisionista. SQL limita resultados a solicitudes aceptadas o encomiendas de viajes propios. |
| CA03–CA04 | Pantalla `Clientes` permite buscar por nombre, correo, DNI y teléfono, y cargar el detalle desde API. |
| CA05–CA06 | El detalle vuelve a comprobar el vínculo; clientes ajenos/no vinculados no aparecen (404). La suite enfocada existente no se ejecutó en este turno. |
| Estado | Implementado según inspección de código; pruebas de autorización pendientes de reejecución. |

## US09 — Modificar información de usuario Comisionista

| Criterio | Resultado de revisión |
|---|---|
| CA01, CA04 | Formulario deja DNI/email en solo lectura. Backend rechaza modificaciones de ambos; nombre, apellido y teléfono actualizan el perfil. |
| CA02–CA03 | Backend valida nombre, apellido y teléfono requeridos y persiste cambios; conserva la presentación/foto cuando se editan desde perfil. |
| CA05 | La pantalla presenta toast al guardar y alerta ante error. |
| CA06 | Prueba de intento de alterar email/DNI sin cambios persistidos añadida; ejecución autenticada pendiente por el esquema de QA. |
| Estado | Implementado; verificación automatizada pendiente en base QA actualizada. |

## US10 — Consultar información de usuario Comisionista

| Criterio | Resultado de revisión |
|---|---|
| CA01–CA04 | `GET /api/auth/perfil` requiere autenticación y consulta la identidad del token; devuelve nombre, apellido, DNI, email, teléfono, foto y presentación. No modifica registros. |
| CA05 | `Perfil` presenta esos datos y permite editar los datos habilitados. |
| CA06 | La suite existente incluye consulta de perfil; no completó el login en este entorno por las columnas ausentes de la base QA. |
| Estado | Implementado según código; prueba integral pendiente en base QA actualizada. |

## Evidencia de esta revisión

| Acción | Resultado |
|---|---|
| `npm run build` | Aprobado. Vite generó el build; advirtió un chunk JS mayor a 500 kB. |
| `npm run test:auth` | Fallido por incompatibilidad de esquema en la base QA (`login_failed_attempts`, `login_locked_until` ausentes); no permite atribuir esos errores a la lógica revisada. |
| Prueba manual de interfaz | No ejecutada. |

# Validación de criterios de aceptación — US11 a US15 (2026-10-22)

Se revisaron las historias contra la versión actual del código. La base configurada para QA no coincide con el esquema del repositorio: faltan `login_failed_attempts`, `login_locked_until`, `precio_km` y `distancia_km`. Las pruebas de integración dependientes de esas columnas quedan como no concluyentes; no se aplicaron cambios de esquema a QA.

## US11 — Registrar usuario Cliente

| Criterio | Resultado |
|---|---|
| CA01–CA05 | Formulario de registro, endpoint `/api/auth/register`, validaciones, rechazo de email/DNI duplicados y mensaje de resultado están implementados. El rol se fija como cliente en servidor. |
| CA06 | En la ejecución actual, la prueba de alta y normalización de cliente pasó; la suite completa falla luego al iniciar sesión por columnas ausentes en QA. La suite de autenticación anterior ya había verificado formatos y duplicados en QA. |
| Estado | Implementado; suite integral requiere actualizar la base QA al esquema vigente. El correo de verificación no se envía porque no está configurado `SMTP_HOST`. |

## US12 — Baja de usuario Cliente

| Criterio | Resultado |
|---|---|
| CA01–CA03, CA05–CA06 | Perfil ofrece confirmación cancelable. Al confirmar, elimina la cuenta y la interfaz descarta la sesión local. El login posterior se rechaza porque la cuenta ya no existe; no se verificó la revocación de una copia previa del JWT. |
| CA04 | La baja borra en transacción las encomiendas vinculadas al cliente, además de los datos y solicitudes eliminados por cascada. |
| CA07 | La prueba de baja no pudo completar la autenticación por las columnas de bloqueo ausentes en QA. |
| Estado | Implementado por inspección; falta prueba integral en base QA actualizada. |

## US13 — Consultar información de usuario

| Criterio | Resultado |
|---|---|
| CA01–CA04 | `GET /api/auth/perfil` consulta la identidad autenticada; la pantalla muestra nombre, apellido, DNI, correo y teléfono. La consulta es de lectura. |
| CA05 | El endpoint consulta el ID del token y no recibe ID de usuario como selector. Las rutas requieren autenticación. |
| CA06 | La regresión existente de perfil no completó en la suite actual porque el inicio de sesión falla por el esquema de QA. |
| Estado | Implementado por inspección; prueba integral pendiente. |

## US14 — Modificar información de usuario

| Criterio | Resultado |
|---|---|
| CA01–CA05 | Formulario y endpoint permiten nombre, apellido y teléfono; email/DNI se muestran sin edición y el backend del cliente rechaza que se envíen esos campos. La interfaz confirma éxito con toast y errores con alerta. |
| CA06 | La prueba de integración de actualización de cliente no llegó a ejecutarse en esta corrida debido al error de login de QA. El documento conserva evidencia de una ejecución anterior aprobada. |
| Estado | Implementado; reejecución pendiente con esquema QA vigente. |

## US15 — Registrar diagramación de viaje

| Criterio | Resultado |
|---|---|
| CA01–CA02 | Formulario ofrece viajes únicos/diarios/semanales y selecciona origen/destino del catálogo local de localidades. |
| CA03 | El formulario permite usar estimación del mapa, ingresar hora de llegada o ingresar duración. El backend deriva el valor faltante y rechaza horarios inválidos, contradictorios o que cruzan medianoche. |
| CA04–CA07 | Validación del backend cubre localidad, fecha, salida, cupo y repetición; la creación persiste recorrido, horarios y estado `programado`. |
| CA05 | El controlador comprueba conflictos de todas las fechas de una serie antes de insertar; los viajes cancelados se excluyen. |
| CA08 | La pantalla muestra toast y confirmación de alta exitosa. |
| CA09 | Se añadieron regresiones para hora de llegada, duración, recurrencia y superposición. La suite unitaria del validador pasó 5/5; las pruebas de integración de viajes no pudieron verificar persistencia porque QA carece de `distancia_km` y `precio_km`. Este documento ya contiene resultados QA previos aprobados para viaje único, recurrencia y superposición. |
| Estado | Implementado; pruebas unitarias aprobadas. Pruebas integrales nuevas pendientes sobre base QA actualizada. |

## Evidencia de esta ejecución

| Acción | Resultado |
|---|---|
| `node --test test/viaje.validador.test.js` | 5 aprobadas, 0 fallidas; incluye validación nueva de llegada y duración. |
| `node --test --test-name-pattern="registra un comisionista" test/auth.integration.test.js` | 1 aprobada, 0 fallidas; foto, presentación, rol fijo y rechazo de extras inválidos comprobados. |
| `npm run test:auth` | No concluyente para casos autenticados: login devuelve HTTP 500 porque QA no tiene `login_failed_attempts` ni `login_locked_until`. |
| `npm run test:tarifa` | No concluyente para creación: QA no tiene `precio_km` ni `distancia_km`; se producen HTTP 500 antes de verificar persistencia. |
| `npm run build` | Aprobado. Vite generó build de producción; advierte que el chunk JavaScript supera 500 kB. |
| Prueba manual de navegador | No ejecutada. |

---

# Revisión de criterios de aceptación — US16, US17, US18, US19 y US23 — 2026-10-22

La revisión de código confirmó que los flujos principales existen. Las suites de integración se intentaron ejecutar; sus resultados quedan limitados por la base QA desactualizada descrita en la tabla. El build del frontend y el validador unitario sí se ejecutaron correctamente.

## Evidencia de ejecución

| Comando/acción | Resultado observado |
|---|---|
| `npm --prefix backend run test:viaje-validador` | 5 pruebas aprobadas, 0 fallidas: fecha inexistente, bisiesta, llegada/duración y estimaciones contradictorias. |
| `npm run build` (raíz) | Build Vite aprobado; chunk JavaScript de 509.53 kB, con advertencia de tamaño. |
| `npm run test:viajes-estado` (backend) | No concluyente: la preparación de sesión falla con HTTP 500 porque la base QA carece de `usuarios.login_failed_attempts` y `login_locked_until`. |
| `npm run test:retiro` y `npm run test:pasajero` (backend) | No concluyentes: las pruebas fallan al preparar sesión por las columnas de login ausentes. |
| `npm run test:tarifa` (backend) | 19 pruebas, 0 aprobadas; el esquema QA carece también de `viajes.distancia_km`, `viajes.duracion_min` y `comisionistas.precio_km`. No se considera evidencia de defectos funcionales de estas historias. |

## US16 — Registrar cancelación de viaje

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | La vista ofrece cancelación para viajes programados; la ruta exige sesión de comisionista y el controlador rechaza estados no programados. | Implementado; prueba de integración bloqueada por esquema QA. |
| CA02 | `CancelarViajeModal` pide confirmación y permite cerrar/abortar antes de llamar a la API. | Implementado por inspección; sin recorrido manual. |
| CA03 | El controlador cambia el estado a `cancelado`, con alcance para viaje o serie. | Implementado; prueba de integración bloqueada por esquema QA. |
| CA04 | `viajeAdmiteAsociaciones` y el alta de solicitudes verifican que el viaje siga programado. | Implementado por inspección; prueba de integración bloqueada por esquema QA. |

## US17 — Consultar viajes

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | Backend y pantalla aplican filtros de fecha, origen, destino y estado. | Implementado por inspección; integración bloqueada por esquema QA. |
| CA02 | La pantalla permite abrir detalle con recorrido y horarios. | Implementado por inspección; sin recorrido manual. |
| CA03 | La vista informa cuando no hay resultados para los filtros. | Implementado por inspección; sin recorrido manual. |

## US18 — Modificar definición de viaje

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | El backend permite editar origen/destino, fecha, horario y cupo solo en viajes programados. No aparece un campo de vehículo en el formulario ni en el modelo de viaje revisado. | Parcial: recorrido, fecha y horario implementados; vehículo no contemplado. |
| CA02 | Antes de guardar, se verifica superposición con viajes activos y se rechaza la operación sin aplicar cambios. | Implementado; regresión de integración bloqueada por esquema QA. |
| CA03 | Los cambios se persisten y se devuelve el detalle actualizado; la pantalla confirma el guardado. | Implementado por inspección; integración bloqueada y sin recorrido manual. |
| CA04 | La API devuelve `pasajerosAfectados`; la pantalla muestra una alerta al comisionista para que comunique el cambio. No hay notificación visible para los clientes dentro de la app. | Parcial: no notifica directamente a clientes. |

## US19 — Reservar viaje

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | La pantalla lista viajes programados disponibles; el endpoint filtra estado, hora de inicio y cuenta activa. | Implementado; prueba de integración bloqueada por esquema QA. |
| CA02 | El cliente selecciona el viaje, completa la solicitud y confirma el envío; queda pendiente de aprobación del comisionista. | Implementado por inspección; integración bloqueada por esquema QA. |
| CA03 | La API calcula cupos ocupados y rechaza solicitudes de pasajeros sin capacidad suficiente. | Implementado por inspección; prueba de cupos bloqueada por esquema QA. |
| CA04 | La solicitud se persiste vinculada al viaje y al cliente autenticado. | Implementado por inspección; integración bloqueada por esquema QA. |

## US23 — Registrar cancelación de traslado

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | El cliente puede cancelar antes del inicio; backend comprueba estado y hora del viaje. | Implementado por inspección; integración bloqueada por esquema QA. |
| CA02 | La pantalla presenta confirmación con acciones Volver y Confirmar. | Implementado por inspección; sin recorrido manual. |
| CA03 | La API pasa la solicitud a `cancelada`; deja de contar como reserva activa. | Implementado por inspección; integración bloqueada por esquema QA. |
| CA04 | Los cupos se calculan desde pasajeros aceptados, excluyendo solicitudes canceladas, ausentes o canceladas por el comisionista. | Implementado por inspección; integración bloqueada por esquema QA. |

## Pendientes de verificación/cierre

- Actualizar la base QA con `backend/db/schema.sql` en una ventana autorizada y repetir las suites. Esta revisión no modificó la base.
- Incorporar una notificación visible para los clientes afectados por cambios del viaje (US18 CA04); hoy solo se avisa al comisionista.
- Hacer recorrido manual de las pantallas y confirmaciones; un build y la inspección de código no validan la interacción visual.

---

# Revisión y cambios de aceptación — US26, US27, US29, US30, US32 y US40 — 2026-10-22

Se implementó US26 y se agregaron pruebas unitarias/de integración. La integración que persiste recordatorios no pudo completarse contra QA porque no existe allí la tabla nueva `recordatorios_viaje`; no se aplicó `backend/db/schema.sql` a la base. Las demás suites también se vieron afectadas por la columna de login ausente. Los resultados integrales anteriores de US27/US29/US30 se conservan donde ya estaban registrados.

## Evidencia ejecutada

| Comando/acción | Resultado |
|---|---|
| `npm --prefix backend run test:recordatorio` | 1 prueba unitaria aprobada: rechaza anticipación inválida o mayor al tiempo restante. |
| `npm --prefix backend run test:recordatorio:integration` | Ejecución anterior: 2 de 3 pruebas aprobadas. La configuración/consulta falló con HTTP 500 porque QA aún no tiene la tabla `recordatorios_viaje`; validación de anticipación, estado, ID inexistente y aislamiento por propietario sí respondieron como se esperaba. La prueba ahora también cubre DELETE/desactivación, pero esa aserción queda pendiente de reejecución contra una QA con el esquema actualizado. |
| `npm --prefix backend run test:gastos` | Las 8 pruebas puras del validador pasaron. Las de integración no pudieron establecer sesión: QA carece de `usuarios.login_failed_attempts`. |
| `npm --prefix backend run test:encomiendas` | No concluyente: la preparación de sesión falla por `usuarios.login_failed_attempts` ausente. En la ejecución anterior documentada, la suite de encomiendas había aprobado 11/11. |
| `npm --prefix backend run test:tarifa` | No concluyente para US32: la suite depende de `viajes.distancia_km`, `viajes.duracion_min` y `comisionistas.precio_km`, columnas ausentes en QA. |
| `npm run build` | Reejecutado tras hacer optativa la configuración: build aprobado; chunk JavaScript de 511.75 kB, con advertencia de tamaño. |
| SMTP | No se pudo observar entrega real: el entorno no tiene `SMTP_HOST`. El proceso reintentará los recordatorios pendientes hasta poder enviarlos. |

## US26 — Confirmar/configurar recordatorio

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01 | El detalle del viaje programado ofrece un checkbox opcional, desmarcado cuando no hay configuración previa. Sin marcarlo, no se crea ningún recordatorio. | Implementado; build aprobado, sin recorrido manual. |
| CA02 | Al marcarlo, se puede elegir 15 min, 30 min, 1 h, 2 h, 6 h, 12 h, 1 día o 7 días de anticipación. | Implementado. |
| CA03 | API exige entre 1 minuto y 7 días, viaje propio programado y anticipación no mayor al tiempo restante. Persiste un recordatorio solo después de marcar y guardar. Desmarcar uno ya guardado lo desactiva. | Implementado; unidad aprobada. Persistencia integrada pendiente de aplicar esquema en QA. |
| CA04 | La pantalla confirma que se guardó o desactivó el recordatorio y muestra errores si falla la operación. | Implementado por inspección/build; sin prueba manual. |
| CA05 | El servidor revisa únicamente recordatorios configurados y vencidos cada minuto y envía correo al comisionista. Los errores SMTP dejan el aviso pendiente para reintento. Cambiar un viaje reprograma el aviso pendiente; cancelar el viaje lo anula. | Implementado; no se pudo verificar envío por SMTP ni ejecución del worker con datos QA. |

La tabla y el worker se agregaron en `backend/db/schema.sql` y `backend/src/services/recordatorios.service.js`; los endpoints son `GET/PUT/DELETE /api/viajes/:id/recordatorio`. No se programa aviso si el comisionista deja el checkbox desmarcado; DELETE desactiva un recordatorio ya guardado.

## US27 — Registrar pedido de envío de encomienda

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01 | Formulario recoge remitente autenticado, dirección de retiro y datos/dirección del destinatario. | Implementado; fixture previo aprobado. |
| CA02 | Permite peso, dimensiones, contenido, fragilidad y descripción, con validación de campos. | Implementado; fixture previo aprobado. |
| CA03 | Backend crea la encomienda en estado `pendiente`. | Implementado; fixture previo aprobó estado e historial inicial. |
| CA04 | API responde mensaje de creación y pantalla presenta confirmación. | Implementado; fixture previo verificó el mensaje de API. No se repitió con QA desactualizada. |

## US29 — Registrar cancelación de encomienda

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01–CA02 | Cliente propietario puede cancelar encomienda vigente desde la interfaz; se confirma antes de llamar a `PATCH /api/encomiendas/:id/cancelar`. | Implementado; suite de regresión anterior aprobada. |
| CA03–CA04 | Conserva el registro como `cancelada`, con historial; deja de ofrecer acciones de encomienda activa. El listado conserva el registro cancelado como historial. | Implementado; regresión anterior comprobó estado/historial y retiro de acciones. |
| CA05 | La pantalla presenta resultado exitoso o error. | Implementado por inspección; sin recorrido manual. La reejecución actual quedó bloqueada por login QA. |

## US30 — Consultar pedido de encomienda

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01–CA02 | Detalle devuelve los campos de la encomienda y su historial/estado. | Implementado; la suite anterior comprobó detalle. |
| CA03 | Las rutas de consulta son de lectura; no hay `UPDATE` en los controladores de detalle/listado. | Implementado por inspección. |
| CA04 | Detalle exige autenticación; cliente accede a su encomienda, comisionista al viaje vinculado y administrador a la vista general. | Implementado; la suite anterior comprobó propietario, roles y denegaciones. La reejecución quedó bloqueada por el login de QA. |

## US32 — Registrar información de pago

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01–CA02 | Formulario de solicitud de traslado ofrece efectivo y transferencia, para pasajero y encomienda. | Implementado por inspección. |
| CA03 | Validador exige una opción admitida y `POST /api/solicitudes` persiste `forma_pago` en la solicitud asociada al viaje. | Implementado por inspección; suite de tarifa no pudo probar persistencia en QA. |
| CA04 | Detalle de postulaciones del comisionista muestra la forma de pago. | Implementado por inspección; sin recorrido manual. |

Esta verificación cubre servicios solicitados desde el flujo de traslados (`solicitudes_viaje`). El formulario independiente de encomiendas (`/api/encomiendas`) no tiene un campo de pago propio.

## US40 — Registrar un gasto general

| Criterio | Revisión actual | Estado |
|---|---|---|
| CA01 | Formulario incluye tipo/concepto, monto, fecha y descripción. La descripción se marca opcional. | Implementado; confirmar si el criterio exige descripción obligatoria. |
| CA02 | Validador exige concepto, monto numérico mayor a cero y fecha válida; la base persiste el registro. | Implementado; 8 pruebas puras pasaron. Integración bloqueada por esquema de login QA. |
| CA03–CA04 | API crea el gasto (HTTP 201); la pantalla actualiza el listado y muestra toast de confirmación. | Implementado por inspección; integración y recorrido manual pendientes. |

## Pendientes para cerrar estas historias

- Aplicar el esquema actualizado a la base QA y repetir pruebas de integración de US26/27/29/30/32/40.
- Configurar `SMTP_HOST` y comprobar la entrega real del recordatorio de US26.
- Verificar el formulario/toast de US26 y US40 en navegador.
- Confirmar si la descripción del gasto en US40 CA01 debe ser obligatoria.

---

# Revisión de criterios de aceptación — US41 a US48 — 2026-10-22

La inspección de las pantallas, rutas, controladores, esquema y pruebas existentes no encontró criterios funcionales faltantes en estas historias. La suite unitaria pasó; la suite de integración se ejecutó, pero la base QA no permitió iniciar sesión por columnas de autenticación ausentes. No se aplicaron cambios a la base ni se hizo recorrido manual de interfaz.

## Evidencia de ejecución

| Comando/acción | Resultado observado |
|---|---|
| `npm --prefix backend run test:gastos` | Las 8 pruebas unitarias de validadores pasaron. Las pruebas de integración no pudieron evaluar rutas de gastos/tipos porque el login de fixture recibió HTTP 500: la QA no tiene `usuarios.login_failed_attempts` (ni `login_locked_until`). |
| Inspección de `backend/test/gastos.integration.test.js` | La suite contiene casos para edición, validación, borrado y totales, filtros, detalle, asociación, unicidad, permisos, conteo por tipo y protección de categorías con gastos. No se consideran ejecutados en esta corrida por el fallo de preparación de sesión. |
| Interfaz | Código inspeccionado; no se hizo recorrido manual en navegador. |

## US41 — Modificar la información de un gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | Desde el listado o el detalle se puede abrir el formulario de edición; permite cambiar monto, fecha y concepto/tipo. | Implementado por inspección. |
| CA02 | El `PUT` usa el mismo middleware `validarGasto` de la creación y comprueba que el tipo pertenezca al comisionista. | Implementado; pruebas de integración pendientes por QA. |
| CA03 | La fila se actualiza y la respuesta devuelve los valores nuevos; el detalle y listado se recargan. | Implementado; persistencia no revalidada en esta corrida. |
| CA04 | La pantalla presenta toast de éxito o alerta de error. | Implementado por inspección; sin recorrido manual. |

## US42 — Registrar la baja de un gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01–CA02 | La acción Eliminar abre un diálogo de confirmación con opción Cancelar. | Implementado por inspección. |
| CA03 | Al confirmar, `DELETE` elimina la fila y la interfaz muestra un toast de éxito; los errores se muestran en el diálogo. | Implementado por inspección; integración pendiente por QA. |
| CA04 | El listado y total se vuelven a cargar después del borrado; la consulta excluye el gasto eliminado. | Implementado por inspección; integración pendiente por QA. |

## US43 — Consultar los gastos registrados

| Criterio | Verificación | Estado |
|---|---|---|
| CA01–CA02 | La pantalla lista los gastos del comisionista con fecha, concepto y monto, y ofrece Ver detalle, Modificar y Eliminar para cada fila. | Implementado por inspección. |
| CA03 | Ver detalle abre una ficha con concepto, monto, fecha, descripción y fecha de registro. | Implementado por inspección. |
| CA04 | Hay filtros por rango de fechas y tipo de gasto; el servidor ordena por fecha descendente. | Implementado por inspección; integración pendiente por QA. |

## US44 — Asociar un gasto a un tipo de gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01–CA02 | El formulario usa un selector alimentado por los tipos existentes; el servidor valida que el ID pertenezca al comisionista autenticado. | Implementado por inspección; integración pendiente por QA. |
| CA03 | El gasto guarda `tipo_gasto_id`; al renombrar un tipo, las filas existentes conservan la relación y muestran el nombre actualizado. | Implementado; la suite contiene regresión para esta relación, bloqueada por login QA. |

## US45 — Registrar un tipo de gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | Formulario admite nombre obligatorio y descripción opcional. | Implementado por inspección. |
| CA02 | Se valida el nombre y hay índice único por comisionista, sin distinguir mayúsculas; conflictos concurrentes responden HTTP 409. | Implementado; pruebas unitarias aprobadas y pruebas de persistencia pendientes por QA. |
| CA03 | Tras guardar se muestra confirmación, se recarga la lista y se actualizan los tipos disponibles para el formulario de gastos. | Implementado por inspección; sin recorrido manual. |

## US46 — Modificar un tipo de gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01 | Desde el listado se abre el formulario para editar nombre y descripción. | Implementado por inspección. |
| CA02 | El índice único y el controlador rechazan nombres duplicados con HTTP 409. | Implementado; pruebas de integración pendientes por QA. |
| CA03 | Los gastos guardan una referencia al ID del tipo; al cambiar su nombre/descripción, los gastos históricos siguen asociados y muestran el nombre nuevo. | Implementado por inspección; suite contiene regresión, pendiente por QA. |

## US47 — Consultar los tipos de gastos disponibles

| Criterio | Verificación | Estado |
|---|---|---|
| CA01–CA02 | La pantalla lista nombre, descripción y cantidad de gastos por tipo, limitada a los tipos del comisionista autenticado. | Implementado por inspección; integración pendiente por QA. |

## US48 — Dar de baja un tipo de gasto

| Criterio | Verificación | Estado |
|---|---|---|
| CA01–CA02 | Cada tipo ofrece Eliminar y abre un diálogo de confirmación. | Implementado por inspección. |
| CA03 | Si hay gastos asociados, el diálogo explica el motivo y deshabilita confirmar; el servidor también rechaza el borrado con HTTP 409. | Implementado por inspección; prueba de integración pendiente por QA. |
| CA04 | Un tipo sin gastos se elimina y deja de aparecer en el listado y los selectores al recargar. | Implementado por inspección; persistencia pendiente por QA. |
| CA05 | El esquema usa una referencia restrictiva entre gasto y tipo. La eliminación está bloqueada mientras haya gastos, conservando la relación y el historial. | Implementado; la suite incluye regresión de protección, pendiente por QA. |

## Observaciones

- Los tipos de gasto son privados por comisionista; la unicidad de nombre se exige dentro de su cuenta y un tipo de otro comisionista no puede asignarse.
- Para cerrar las pruebas integrales hace falta actualizar la base QA con `backend/db/schema.sql` y repetir `npm run test:gastos`. La revisión no modificó la base.
- La descripción del gasto sigue siendo opcional en la implementación actual de US40; confirmar si el criterio CA01 anterior debe tratarla como obligatoria.

---

# Corrección de identidad por DNI y compatibilidad de esquema — 2026-10-22

Se investigó el error `no existe la columna «usuario_id»` mediante una consulta de solo lectura a los catálogos de PostgreSQL. La QA tenía una tabla `gastos` heredada con `viaje_id`, `categoria`, `monto` y `fecha`, pero sin `usuario_id` ni `tipo_gasto_id`; `CREATE TABLE IF NOT EXISTS` no actualizaba esa tabla existente. También faltaban en `usuarios` las columnas de intentos/bloqueo de login que el backend actual requiere.

## Cambios preparados

- `usuarios.dni` pasa a ser el DNI canónico, con índice único para impedir cuentas duplicadas. Se copian allí los DNI existentes de `clientes` y `comisionistas`.
- El perfil y el asunto (`sub`) de los nuevos tokens de sesión/verificación usan el DNI. Se conserva `usuarios.id` como clave técnica para las relaciones internas existentes y por compatibilidad de controladores.
- El esquema agrega a tablas ya existentes las columnas de login faltantes.
- La migración de `gastos` añade `usuario_id`, `tipo_gasto_id` y columnas actuales; deriva el propietario del viaje histórico y crea tipos de gasto a partir de `categoria`. Conserva la columna antigua y aborta con un mensaje explícito si encuentra gastos cuyo dueño/categoría no se puedan migrar.

## Evidencia y límite

| Verificación | Resultado |
|---|---|
| Inspección de columnas en QA (solo lectura) | Confirmó la tabla de gastos heredada y 10 filas; las 10 tienen viaje asociado y hay 2 categorías, por lo que el origen del propietario/categoría existe para esos datos. También se detectó una cuenta sin DNI; el índice permite temporalmente DNI nulo para no bloquear administradores o registros heredados incompletos. |
| Duplicados de DNI existentes en QA (solo lectura) | No se encontraron duplicados entre perfiles cliente/comisionista. |
| `node --check` de controlador y regresiones de autenticación | Sin errores de sintaxis. |
| Aplicación de `schema.sql` | No ejecutada; la base QA no fue modificada. |
| Pruebas de integración | Pendientes hasta ejecutar el esquema actualizado. La corrida anterior de gastos falló al iniciar sesión por `usuarios.login_failed_attempts` ausente. |

Para aplicar la migración en la base deseada, ejecutar desde la raíz del proyecto: `psql -d comitrack -v ON_ERROR_STOP=1 -f backend/db/schema.sql`. Luego repetir `npm run test:auth` y `npm run test:gastos` (el segundo desde `backend`).
