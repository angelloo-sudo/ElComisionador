# Verificación preliminar de identidad

El módulo permite que clientes y comisionistas compartan resultados mínimos de una lectura OCR y una comprobación guiada de movimientos faciales para revisión administrativa. Es un prototipo académico: no valida oficialmente la identidad ni la autenticidad del DNI.

## Uso local

1. Instalar dependencias desde la raíz con `npm run install:all`.
2. Configurar el backend y PostgreSQL como indica el README. La aplicación no crea ni actualiza las tablas al iniciar; `verificaciones_identidad` ya está definida en `backend/db/schema.sql` para bases nuevas.
3. Iniciar backend y frontend con `npm run dev`.
4. Para una cuenta nueva, elegir cliente o comisionista y completar la verificación dentro del alta, antes de que el backend cree la cuenta. El OCR y los controles faciales son los mismos del módulo; el envío crea la cuenta y su solicitud `PENDIENTE_REVISION` en una única transacción. Una cuenta existente puede seguir usando **Verificación** desde la navegación o **Mi perfil**.
5. Una cuenta con rol `administrador` puede abrir **Verificaciones**, buscar por usuario, filtrar el estado y resolver solicitudes.

La cámara requiere permiso explícito y un contexto seguro: HTTPS o `localhost`. Para una computadora sin cámara frontal se puede conectar una cámara compatible; si el navegador o dispositivo no permite `getUserMedia`, la comprobación no se completa.

## Tecnologías y recursos incluidos

- React 18, Vite 5 y Node.js 24 en el entorno de implementación.
- `tesseract.js@7.0.0` ejecuta el OCR en el navegador. El idioma español usa el modelo `spa` `4.0.0_best_int` de `@tesseract.js-data/spa`, incluido en `frontend/public/vendor/tesseract/` junto con el worker y los núcleos WebAssembly compatibles con las variantes de SIMD.
- `@mediapipe/tasks-vision@1.2.2` y sus archivos WebAssembly están incluidos en `frontend/public/vendor/mediapipe/wasm/`. El modelo Face Landmarker se sirve localmente desde `frontend/public/models/face_landmarker.task`.
- La instalación normal con npm solo descarga dependencias de desarrollo. Los datos de idioma y el modelo facial están versionados localmente; el navegador no descarga modelos o workers desde CDN al ejecutar el flujo.

## Flujo OCR y cámara

Las imágenes elegidas como archivos se mantienen como objetos en memoria de la página. Tesseract analiza frente y dorso localmente; el extractor busca número de DNI, nombre, apellido, fechas y número de trámite mediante etiquetas comunes. Los formatos impresos y la calidad de la foto pueden variar, por lo que los campos se pueden corregir. Una lectura incompleta se marca para revisión y nunca produce una aprobación automática.

La cámara frontal se abre cuando el usuario inicia el desafío. Face Landmarker busca un rostro, detecta categorías de parpadeo y estima un giro aproximado a partir de puntos faciales: frente, parpadeo, giro y regreso al frente. Al completar esos pasos se captura una selfie temporal como vista previa para el usuario. Tanto esa vista previa como las imágenes del DNI solo existen en memoria durante el proceso; no se envían y se liberan al enviar, cancelar o salir de la pantalla. Los umbrales faciales son heurísticos y dependen de iluminación, cámara, encuadre y dispositivo. No se compara el rostro con una base de datos. Las pistas de cámara y el detector se liberan al terminar, cancelar o salir de la pantalla.

El SDK de MediaPipe procesa los datos de entrada en el dispositivo y declara que no los envía a Google, pero también puede transmitir métricas técnicas de uso y rendimiento. El consentimiento de la pantalla informa este comportamiento. [Aviso de privacidad de MediaPipe Tasks](https://developers.google.com/edge/mediapipe/solutions/privacy).

## Endpoints reutilizados

Todas las rutas requieren el JWT existente. El backend verifica rol y propiedad; la interfaz no sustituye esas comprobaciones.

| Método y ruta | Uso | Contrato principal |
| --- | --- | --- |
| `POST /api/verificaciones` | Cliente/comisionista inicia | `{ "consentimiento": true }`; devuelve `id`, `estado: EN_PROCESO` y fechas. Si existe una activa, responde 409. |
| `GET /api/verificaciones/mias` | Consultar estado e historial propios | Devuelve las solicitudes del usuario autenticado, con resultados mínimos y motivo de resolución. |
| `PATCH /api/verificaciones/:id/enviar` | Enviar resultados | `dni_parcial`, `resultado_ocr`, `coincidencias` (`nombre`, `apellido`, `dni`) y `controles_faciales` (`rostro_unico`, `parpadeo`, `giro`, `frente`). El servidor fija `PENDIENTE_REVISION`. |
| `GET /api/verificaciones/admin?estado=...` | Administrador lista solicitudes | Puede filtrar por estado; devuelve datos de cuenta, DNI parcialmente oculto, resultados y antecedentes de resolución. |
| `GET /api/verificaciones/admin/:id` | Administrador consulta el detalle | Devuelve los mismos datos mínimos de una solicitud individual; requiere rol administrador. |
| `PATCH /api/verificaciones/admin/:id/resolver` | Administrador resuelve | `{ "decision": "APROBADA_MANUALMENTE" }` o decisión `RECHAZADA` / `REQUIERE_CORRECCION` con `motivo` de 3 a 500 caracteres. |

El payload de envío no contiene imágenes, selfie, DNI completo, OCR textual, fechas de nacimiento/vencimiento, número de trámite ni vectores faciales. El servidor rechaza OCR distinto de `legible` y controles faciales incompletos. En PostgreSQL se persisten solo los campos ya contemplados por `verificaciones_identidad`: DNI parcial, calidad OCR, comparaciones booleanas, controles booleanos, marcas de tiempo y resolución.

## Estados

- `NO_INICIADA`: todavía no comenzó.
- `EN_PROCESO`: se inició y se puede retomar; las imágenes deben capturarse de nuevo porque el navegador no persiste el progreso sensible.
- `PENDIENTE_REVISION`: enviada y pendiente de administración.
- `APROBADA_MANUALMENTE`: el administrador aceptó los controles preliminares.
- `RECHAZADA`: el administrador rechazó con motivo.
- `REQUIERE_CORRECCION`: el administrador indicó qué corregir; el usuario puede iniciar una nueva solicitud.

## Privacidad y límites

- Las imágenes se procesan en el navegador y no se envían a la API de ComiTrack ni se escriben en PostgreSQL, carpetas públicas, `localStorage` o `sessionStorage`.
- Solo se envían y conservan los resultados mínimos validados por el backend. El DNI se muestra parcialmente oculto en el historial y en el panel administrativo.
- No se modifica automáticamente el perfil. Los desacuerdos se presentan al administrador.
- No hay integración con RENAPER ni proveedor KYC, y no se consulta una API externa para validar documentos.
- La lectura OCR puede equivocarse. Los controles faciales no son una prueba de vida robusta ni protegen contra fotos, videos o ataques de presentación. La decisión administrativa no certifica oficialmente identidad.
- MediaPipe puede transmitir métricas técnicas de utilización; este comportamiento no contiene las imágenes ni el resultado facial según su aviso de privacidad.
- El módulo es un prototipo académico preparado para una futura integración profesional, sujeto a revisión legal, de seguridad, privacidad y accesibilidad antes de uso productivo.

## Verificación de desarrollo

Desde `frontend/`:

```bash
npm run test:verificacion
npm run build
```

Desde `backend/`, las validaciones existentes del módulo son:

```bash
node --test test/verificacion.validador.test.js
node --test test/verificaciones.integration.test.js
```

La prueba de integración usa la base configurada y crea cuentas de prueba con identificadores aleatorios; limpia esas cuentas al terminar. Ejecutarla solo en una base de desarrollo o QA.
