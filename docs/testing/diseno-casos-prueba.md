# US01 – Iniciar sesión

## Diseño de casos de prueba

### CP-US01-01 – Inicio válido y datos de sesión

| Campo | Descripción |
|---|---|
| Nombre | Inicio válido y datos de sesión. |
| Objetivo | Verificar autenticación, token utilizable y datos públicos correctos. |
| Precondiciones | Cuenta de prueba activa, verificada y sin bloqueo. |
| Datos de prueba | Email y contraseña válidos de un cliente y un comisionista. |
| Pasos | 1. Enviar `POST /api/auth/login`. 2. Consultar `/api/auth/perfil` con el token. 3. Revisar rol y campos devueltos. |
| Resultado esperado | HTTP 200, token utilizable, perfil y rol correctos; no se expone contraseña ni hash. |

### CP-US01-02 – Credenciales inválidas

| Campo | Descripción |
|---|---|
| Nombre | Rechazo de credenciales incorrectas o incompletas. |
| Objetivo | Comprobar que un acceso inválido no inicia sesión. |
| Precondiciones | API disponible y cuenta activa de prueba sin bloqueo. |
| Datos de prueba | Contraseña incorrecta, email inexistente y contraseña ausente. |
| Pasos | 1. Enviar un login por cada combinación. 2. Revisar estado, mensaje y cuerpo de respuesta. |
| Resultado esperado | Credenciales inválidas rechazadas con HTTP 401, mensaje genérico y sin token. |

### CP-US01-03 – Primer bloqueo temporal

| Campo | Descripción |
|---|---|
| Nombre | Bloqueo tras tres intentos fallidos. |
| Objetivo | Verificar el bloqueo de 30 segundos y el rechazo durante ese período. |
| Precondiciones | Cuenta activa y verificada con contador de fallos reiniciado en la base QA. |
| Datos de prueba | Tres contraseñas incorrectas consecutivas y luego la correcta. |
| Pasos | 1. Enviar dos logins fallidos. 2. Enviar un tercero. 3. Intentar durante el bloqueo. 4. Tras vencer, iniciar sesión correctamente. |
| Resultado esperado | Dos respuestas 401; el tercer fallo bloquea por unos 30 segundos; el acceso durante el bloqueo se rechaza y luego puede iniciar sesión. |

### CP-US01-04 – Segundo bloqueo y reinicio

| Campo | Descripción |
|---|---|
| Nombre | Segundo ciclo de fallos y reinicio por acceso exitoso. |
| Objetivo | Comprobar el bloqueo de dos minutos y el reinicio al iniciar sesión correctamente. |
| Precondiciones | Cuenta de prueba con primer nivel de bloqueo ya alcanzado y vencido. |
| Datos de prueba | Tres contraseñas incorrectas; contraseña válida después de vencer el segundo bloqueo. |
| Pasos | 1. Generar tres fallos. 2. Intentar durante el bloqueo. 3. Tras su vencimiento, iniciar sesión y volver a comprobar el estado. |
| Resultado esperado | Bloqueo aproximado de 120 segundos; después del acceso válido se reinician los contadores y el nivel. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US01-01 | Bloqueado: la prueba de integración no llegó al login válido; su alta previa fue rechazada por el fixture `nombre: "Usuario de Pruebas"`. | Bloqueado |
| CP-US01-02 | Bloqueado: el test interrumpió el caso al fallar el alta usada como precondición. | Bloqueado |
| CP-US01-03 | La prueba verificó dos rechazos, bloqueo al tercer intento, rechazo durante el bloqueo y recuperación posterior. | Aprobado |
| CP-US01-04 | La prueba verificó el bloqueo de 120 segundos y el reinicio de contadores tras un acceso válido. | Aprobado |

---

# US11 – Registrar usuario Cliente

## Diseño de casos de prueba

### CP-US11-01 – Alta válida de cliente

| Campo | Descripción |
|---|---|
| Nombre | Registrar un cliente con datos válidos. |
| Objetivo | Verificar creación, normalización del email y respuesta sin secretos. |
| Precondiciones | Email, DNI y teléfono sintéticos no registrados. |
| Datos de prueba | Nombre y apellido válidos, email con espacios/mayúsculas y contraseña válida. |
| Pasos | 1. Enviar `POST /api/auth/register`. 2. Revisar respuesta. 3. Consultar el usuario creado en la base QA. |
| Resultado esperado | HTTP 201; email normalizado; cuenta de rol cliente y no verificada; no se devuelven contraseña ni hash. |

### CP-US11-02 – Validaciones de campos

| Campo | Descripción |
|---|---|
| Nombre | Rechazar campos requeridos o formatos inválidos. |
| Objetivo | Comprobar validación sin creación parcial. |
| Precondiciones | Base QA disponible. |
| Datos de prueba | Nombre, email, contraseña, DNI o teléfono ausentes o inválidos. |
| Pasos | 1. Enviar cada variante inválida. 2. Consultar si se creó algún usuario con los datos de prueba. |
| Resultado esperado | HTTP 400 con errores de validación y sin registro parcial. |

### CP-US11-03 – Email duplicado y rol

| Campo | Descripción |
|---|---|
| Nombre | Impedir email duplicado y elevación de rol. |
| Objetivo | Comprobar unicidad del correo y que el cliente no pueda asignarse otro rol. |
| Precondiciones | Cuenta cliente de prueba ya registrada. |
| Datos de prueba | Repetir el email existente con distinta capitalización y enviar `rol: administrador`. |
| Pasos | 1. Repetir el alta con el email existente. 2. Enviar un alta nueva manipulando el rol. 3. Consultar el resultado persistido. |
| Resultado esperado | El email duplicado se rechaza sin crear otra cuenta; un alta aceptada conserva rol cliente. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US11-01 | Bloqueado: los tests de alta válida usan `nombre: "Usuario de Pruebas"`, rechazado por el validador antes de completar el caso. | Bloqueado |
| CP-US11-02 | Bloqueado: las aserciones de campos inválidos no se alcanzaron porque falló antes el alta usada como precondición. | Bloqueado |
| CP-US11-03 | Bloqueado: no se alcanzó a verificar duplicado ni rol; falló el alta inicial por el fixture de nombre inválido. | Bloqueado |

---

# US14 – Modificar información de usuario Cliente

## Diseño de casos de prueba

### CP-US14-01 – Modificación de datos permitidos

| Campo | Descripción |
|---|---|
| Nombre | Actualizar nombre, apellido y teléfono propios. |
| Objetivo | Verificar que los datos permitidos se actualizan en el perfil correcto. |
| Precondiciones | Cliente de prueba con sesión válida y perfil conocido. |
| Datos de prueba | Nuevo nombre, apellido y teléfono válidos. |
| Pasos | 1. Enviar `PUT /api/auth/perfil` autenticado. 2. Consultar el perfil propio. |
| Resultado esperado | HTTP 200 con los nuevos valores y el mismo usuario asociado. |

### CP-US14-02 – Protección de DNI y email

| Campo | Descripción |
|---|---|
| Nombre | Intentar modificar campos inmutables. |
| Objetivo | Comprobar que DNI y email no cambian al actualizar el perfil. |
| Precondiciones | Cliente de prueba autenticado; valores originales registrados. |
| Datos de prueba | Body con nuevos DNI y email junto con un cambio permitido. |
| Pasos | 1. Enviar la actualización. 2. Consultar el perfil y comparar con los valores originales. |
| Resultado esperado | DNI y email permanecen iguales; el sistema rechaza o ignora esos campos conforme al criterio vigente. |

### CP-US14-03 – Validación y autorización

| Campo | Descripción |
|---|---|
| Nombre | Rechazar cambios inválidos y accesos no autenticados. |
| Objetivo | Verificar validaciones y que el usuario sólo edite su propio perfil. |
| Precondiciones | Cliente de prueba y perfil original; token válido y solicitud anónima. |
| Datos de prueba | Teléfono inválido, body que intenta indicar otro usuario y solicitud sin token. |
| Pasos | 1. Enviar cambio inválido autenticado. 2. Intentar editar sin token. 3. Verificar que no se alteró el perfil original. |
| Resultado esperado | Cambios inválidos rechazados sin modificación; solicitud anónima recibe 401; no se permite editar otro usuario. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US14-01 | Bloqueado: no se ejecutó una prueba de modificación de perfil. | Bloqueado |
| CP-US14-02 | Bloqueado: no se ejecutó un intento de modificar DNI o email. | Bloqueado |
| CP-US14-03 | Bloqueado: no se ejecutaron las validaciones ni el control de acceso del endpoint de edición. | Bloqueado |

---

# US15 – Registrar diagramación de viaje

## Diseño de casos de prueba

### CP-US15-01 – Registrar viaje único

| Campo | Descripción |
|---|---|
| Nombre | Crear un viaje único con datos válidos. |
| Objetivo | Verificar persistencia y cálculo de llegada/duración según los datos ingresados. |
| Precondiciones | Comisionista autenticado y localidades disponibles en el entorno QA. |
| Datos de prueba | Origen, destino, fecha futura, hora de salida, cupo válido y opción de duración/llegada definida por la HU. |
| Pasos | 1. Enviar `POST /api/viajes`. 2. Consultar el viaje creado. 3. Comparar propietario, recorrido y horario. |
| Resultado esperado | Viaje programado y asociado al comisionista; horario y confirmación coherentes con la opción elegida. |

### CP-US15-02 – Validación y superposición

| Campo | Descripción |
|---|---|
| Nombre | Rechazar datos inválidos y horarios superpuestos. |
| Objetivo | Verificar validaciones y prevención de superposición para viajes activos del mismo comisionista. |
| Precondiciones | Comisionista autenticado con un viaje programado existente en fixture aislado. |
| Datos de prueba | Fecha/hora inválidas, cupo no permitido y otro viaje cuyo horario se superpone. |
| Pasos | 1. Enviar cada variante inválida. 2. Enviar un viaje superpuesto. 3. Consultar que no hubo inserciones. |
| Resultado esperado | Datos inválidos rechazados y superposición denegada sin persistencia parcial. |

### CP-US15-03 – Repetición y localidades

| Campo | Descripción |
|---|---|
| Nombre | Registrar serie recurrente con localidades válidas. |
| Objetivo | Comprobar fechas generadas para la repetición y disponibilidad de localidades desde el servicio previsto. |
| Precondiciones | Comisionista autenticado y catálogo/servicio de localidades disponible. |
| Datos de prueba | Viaje diario o semanal con fecha inicial futura y localidades del catálogo. |
| Pasos | 1. Seleccionar localidades. 2. Registrar repetición. 3. Consultar ocurrencias y fechas persistidas. |
| Resultado esperado | Sólo se crean las ocurrencias que corresponden a la regla documentada y no quedan registros parciales. |

### CP-US15-04 – Rol y propiedad

| Campo | Descripción |
|---|---|
| Nombre | Restringir el registro y la gestión al rol/propietario correspondiente. |
| Objetivo | Verificar que un cliente no registre viajes y que un comisionista no gestione los de otro. |
| Precondiciones | Sesiones de cliente y de dos comisionistas; viaje de prueba de uno de ellos. |
| Datos de prueba | Solicitud de alta como cliente y consultas del viaje propio/ajeno como comisionistas. |
| Pasos | 1. Intentar alta como cliente. 2. Consultar el viaje ajeno. 3. Consultar el propio. |
| Resultado esperado | Cliente denegado; comisionista sin acceso al viaje ajeno y con acceso al propio. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US15-01 | Bloqueado: no se ejecutó una prueba de alta de viaje y estimación de horario. | Bloqueado |
| CP-US15-02 | Bloqueado: no se ejecutaron validaciones ni prevención de superposición. | Bloqueado |
| CP-US15-03 | Bloqueado: no se ejecutaron repetición ni selección de localidades. | Bloqueado |
| CP-US15-04 | Bloqueado: no se probó autorización/propiedad para viajes. | Bloqueado |

---

# US16 – Registrar la cancelación de viaje

## Diseño de casos de prueba

### CP-US16-01 – Cancelar viaje programado

| Campo | Descripción |
|---|---|
| Nombre | Cancelar un viaje único programado. |
| Objetivo | Verificar el cambio de estado y que no admita nuevas asociaciones. |
| Precondiciones | Comisionista propietario autenticado; viaje único en estado programado. |
| Datos de prueba | ID de viaje programado de la fecha de prueba. |
| Pasos | 1. Enviar `PATCH /api/viajes/:id/cancelar`. 2. Consultar el estado. 3. Intentar una nueva asociación permitida por el sistema. |
| Resultado esperado | HTTP 200, viaje cancelado y sin nuevas asociaciones. |

### CP-US16-02 – Alcance de cancelación de serie

| Campo | Descripción |
|---|---|
| Nombre | Cancelar ocurrencia, siguientes o serie. |
| Objetivo | Comprobar el alcance seleccionado sin alterar ocurrencias ya realizadas. |
| Precondiciones | Serie de viajes con ocurrencias futuras y, si aplica, una ocurrencia ya realizada. |
| Datos de prueba | ID de una ocurrencia y alcances `este`, `siguientes` y `serie` según contrato. |
| Pasos | 1. Cancelar con cada alcance en fixtures separados. 2. Consultar estados de la serie y su repetición. |
| Resultado esperado | Se cancelan sólo las ocurrencias previstas por cada alcance; las realizadas no cambian y la serie se corta cuando corresponde. |

### CP-US16-03 – Estado, permisos y alcance inválido

| Campo | Descripción |
|---|---|
| Nombre | Rechazar cancelaciones no permitidas. |
| Objetivo | Comprobar estado elegible, rol y propiedad del viaje. |
| Precondiciones | Viajes programado y no programado; sesiones del dueño, otro comisionista y cliente. |
| Datos de prueba | ID de viaje propio/ajeno y alcance no reconocido. |
| Pasos | 1. Cancelar el viaje no programado. 2. Usar alcance inválido. 3. Intentar como cliente y comisionista ajeno. 4. Consultar estados. |
| Resultado esperado | Rechazo sin cambios para estado/alcance inválido y actores no autorizados; el propietario puede cancelar el programado. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US16-01 | Bloqueado: no se ejecutó una cancelación de viaje programado. | Bloqueado |
| CP-US16-02 | Bloqueado: no se probaron alcances de cancelación de series. | Bloqueado |
| CP-US16-03 | Bloqueado: no se probaron estados, alcances inválidos ni permisos de cancelación. | Bloqueado |

---

# US27 – Registrar pedido de envío de encomienda

## Diseño de casos de prueba

### CP-US27-01 – Registro válido y persistencia

| Campo | Descripción |
|---|---|
| Nombre | Registrar una encomienda completa. |
| Objetivo | Verificar persistencia, estado inicial, historial y datos del remitente autenticado. |
| Precondiciones | Cliente con ficha activa y token válido en base QA. |
| Datos de prueba | Dirección de retiro/entrega, destinatario, tipo, peso, dimensiones y fragilidad válidos. |
| Pasos | 1. Enviar `POST /api/encomiendas`. 2. Consultar la lista propia. 3. Revisar propietario, estado e historial. |
| Resultado esperado | Solicitud pendiente asociada al cliente autenticado, remitente derivado de su perfil e historial inicial coherente. |

### CP-US27-02 – Validación de datos

| Campo | Descripción |
|---|---|
| Nombre | Rechazar datos incompletos o fuera de dominio. |
| Objetivo | Comprobar validaciones sin persistencia parcial. |
| Precondiciones | Cliente autenticado. |
| Datos de prueba | Campo obligatorio vacío, valor fuera de límites y tipo `otro` sin aclaración. |
| Pasos | 1. Enviar cada variante. 2. Revisar respuesta. 3. Consultar la lista para confirmar que no se creó la solicitud. |
| Resultado esperado | Solicitudes inválidas rechazadas sin alta parcial. |

### CP-US27-03 – Autorización e identidad remitente

| Campo | Descripción |
|---|---|
| Nombre | Denegar roles no permitidos y evitar suplantación. |
| Objetivo | Verificar que sólo un cliente autenticado pueda registrar a su nombre. |
| Precondiciones | Sesiones anónima, cliente y comisionista; cliente con ficha activa. |
| Datos de prueba | Datos válidos con `cliente_remitente_id` ajeno en el body. |
| Pasos | 1. Intentar alta anónima. 2. Intentar como comisionista. 3. Crear como cliente manipulando el ID. 4. Revisar el propietario persistido. |
| Resultado esperado | Anónimo y comisionista rechazados; el propietario se deriva de la sesión del cliente. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US27-01 | El test creó la encomienda en la base QA aislada y verificó propietario, estado pendiente, remitente derivado, historial inicial y listado posterior. | Aprobado |
| CP-US27-02 | Los tests rechazaron datos incompletos, campos fuera de límite y `otro` sin aclaración; no se observó alta parcial. | Aprobado |
| CP-US27-03 | Los tests rechazaron alta anónima y rol comisionista; al manipular el ID, se persistió el cliente autenticado. | Aprobado |

---

# US29 – Registrar cancelación de encomienda

## Diseño de casos de prueba

### CP-US29-01 – Cancelar antes del retiro

| Campo | Descripción |
|---|---|
| Nombre | Cancelar una encomienda propia no retirada. |
| Objetivo | Verificar la cancelación permitida antes del retiro y su reflejo en el seguimiento. |
| Precondiciones | Encomienda propia pendiente o aceptada, aún no retirada; actor autorizado. |
| Datos de prueba | Encomienda sintética y sesión del cliente propietario. |
| Pasos | 1. Iniciar la acción de cancelación desde el flujo disponible. 2. Confirmar. 3. Consultar estado/lista. |
| Resultado esperado | La solicitud pasa a cancelada, deja de figurar como activa y se informa el resultado. |

### CP-US29-02 – Rechazar cancelación después del retiro

| Campo | Descripción |
|---|---|
| Nombre | Impedir cancelación desde el retiro. |
| Objetivo | Comprobar el límite temporal establecido para el cliente. |
| Precondiciones | Encomienda propia en estado retirado. |
| Datos de prueba | ID de la encomienda retirada y token del propietario. |
| Pasos | 1. Solicitar cancelación. 2. Consultar estado e historial. |
| Resultado esperado | Operación rechazada; registro, estado e historial permanecen sin cambios. |

### CP-US29-03 – Permisos de cancelación

| Campo | Descripción |
|---|---|
| Nombre | Verificar propietario, rol y operación vinculada. |
| Objetivo | Impedir cancelación por terceros o por un comisionista no vinculado. |
| Precondiciones | Encomienda de cliente A y sesiones de cliente A/B, comisionista vinculado/no vinculado y anónimo. |
| Datos de prueba | Mismo ID de encomienda para todos los actores. |
| Pasos | 1. Intentar cancelar como cada actor. 2. Consultar estado después de cada intento. |
| Resultado esperado | Sólo los actores autorizados por la HU pueden cancelar, dentro del límite temporal del cliente; los demás no producen cambios. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US29-01 | Bloqueado: no se ejecutó la cancelación lógica; el test existente sólo comprueba eliminación de una solicitud como operación de US27. | Bloqueado |
| CP-US29-02 | Bloqueado: no se intentó cancelar una encomienda retirada mediante el flujo de esta historia. | Bloqueado |
| CP-US29-03 | Bloqueado: no se probó cancelación por roles/operaciones desde un endpoint dedicado. | Bloqueado |

---

# US30 – Consultar pedido de encomienda

## Diseño de casos de prueba

### CP-US30-01 – Cliente consulta sus encomiendas

| Campo | Descripción |
|---|---|
| Nombre | Consultar solicitudes propias y su seguimiento. |
| Objetivo | Verificar aislamiento por cliente e información de estado/historial. |
| Precondiciones | Clientes A y B con encomiendas distintas en base QA. |
| Datos de prueba | Tokens de ambos clientes e IDs de sus solicitudes. |
| Pasos | 1. Consultar `GET /api/encomiendas/mis-solicitudes` como A y B. 2. Comparar IDs, estados e historial. |
| Resultado esperado | Cada cliente ve exclusivamente sus solicitudes y su información de seguimiento. |

### CP-US30-02 – Comisionista consulta operaciones vinculadas

| Campo | Descripción |
|---|---|
| Nombre | Aislar listados por comisionista. |
| Objetivo | Comprobar que el comisionista sólo consulta encomiendas vinculadas a sus operaciones. |
| Precondiciones | Comisionistas A/B con operaciones y encomiendas separadas. |
| Datos de prueba | Tokens de ambos comisionistas e IDs vinculados/no vinculados. |
| Pasos | 1. Consultar las listas disponibles como cada comisionista. 2. Comparar los resultados con sus operaciones. |
| Resultado esperado | Cada comisionista recibe únicamente encomiendas vinculadas a sus operaciones. |

### CP-US30-03 – Acceso anónimo y consulta individual

| Campo | Descripción |
|---|---|
| Nombre | Proteger datos privados y manejar IDs. |
| Objetivo | Verificar acceso por rol a listas/detalle y respuesta para IDs inválidos, inexistentes o ajenos. |
| Precondiciones | Encomienda de prueba y sesiones anónima, cliente y comisionista. |
| Datos de prueba | ID existente, inexistente, malformado y ajeno. |
| Pasos | 1. Consultar listas y detalle con cada actor. 2. Probar cada ID. 3. Revisar que no se expongan datos ajenos. |
| Resultado esperado | Sin acceso anónimo a información privada; detalle sólo para actor autorizado; respuestas de error no filtran información ajena. |

## Resultado de los casos de prueba

| ID | Resultado obtenido | Estado |
|---|---|---|
| CP-US30-01 | El test consultó la lista de dos clientes: el propietario encontró su encomienda y el otro recibió una lista vacía; también se verificó el historial. | Aprobado |
| CP-US30-02 | Bloqueado: no se verificó aislamiento de listados por comisionista. | Bloqueado |
| CP-US30-03 | Bloqueado: no se ejecutaron las consultas individuales ni todas las variantes de acceso anónimo/por rol. | Bloqueado |
