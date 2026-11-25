# Informe de maquetación — Definición del Producto (rediseño ComiTrack)

Documento revisado: `Definición del Producto - ComiTrack (diseño).docx` (85 páginas: portada + 84 numeradas).
Fuente: `DefProductoCambios.pdf` (versión con las correcciones del equipo, 118 páginas).

## 1. Cambios del equipo incorporados

Sobre el diseño anterior solo cambió el contenido que el equipo modificó. El diseño se mantuvo igual.

- **Portada:** «Bartolelli, Francisco».
- **Índice:** «9.3. Maquina de Transición de estados para “Pasajeros”».
- **US57:** se quitó del Product Backlog y de la Épica 4 (capítulos 4 y 6).
- **US31 – Actualizar estado de encomienda (nueva):** tiene descripción, nueve criterios de aceptación y tres capturas de prototipo.
- **Títulos y etiquetas:**
  - «7. Descripción de cada US», sin los dos puntos.
  - «Diseño de casos de prueba» en US01.
  - «Épica 4» con tilde.
  - «Epica 6: Administración de ingresos», con tilde en «Administración».
  - «US16 - », «US33 - », «US34 - », «US35 - », «US40 - » y «US47 - » con el formato unificado.
  - «9.3.» y «10.1.1. Software».
- **US29, caso 1:** el estado pasó de Aprobado a Fallido.
- **US37, US38 y US39:** se agregó la etiqueta «Criterios de aceptación».
- **Captura de US36:** el equipo la achicó; se respetó el nuevo tamaño.
- **Tabla de Software:** dice «react-leaflet».
- **Historial:** «Jofre, Matias Javier», con espacio.

## 2. Conservación del contenido

| Sección | Fuente | Nuevo | Diferencias |
|---|---|---|---|
| Portada | 56 palabras | 56 palabras | Ninguna |
| Índice (títulos y numeración) | 92 palabras | 92 palabras | Ninguna |
| Texto fuera de tablas | 10.186 palabras | 10.186 palabras | Ninguna. Mismas palabras y mismo orden |
| Tablas | — | — | Ninguna, salvo los encabezados repetidos al continuar en otra página |
| Imágenes | 97 | 97 | Ninguna. Mismo tamaño y mismo orden |

Hay tres adaptaciones técnicas, ninguna de contenido:

1. **Números de página del índice:** son campos de Word. Se actualizan con clic derecho → *Actualizar campos*.
2. **Vínculo del DER:** el vínculo «Diagrama Entidad-Relación renderizado» (Mermaid) se conservó completo, con sus 2.894 caracteres.
   - Word recorta los vínculos tan largos al guardar, así que se restauró en el .docx y en el PDF. Si alguien vuelve a guardar el .docx desde Word, conviene comprobar que el vínculo siga abriendo el diagrama.
3. **Vínculo espurio en US02 (CA04):** el vínculo automático a `http://nuevamente.aa` sobre la palabra «nuevamente.» no se reprodujo. El texto se conservó.

## 3. Revisión de maquetación

- **Cangurito:** está en las 85 páginas, siempre en la misma posición del pie, sin superponerse con nada.
- **Numeración:** es correlativa del 1 al 84; la portada no se numera.
- **Títulos:**
  - Tienen tres niveles de jerarquía y aparecen en el panel de navegación de Word.
  - Las épicas, las US, las etiquetas y los casos de prueba tienen su propio estilo.
- **Tablas:**
  - Las de casos de prueba no se cortan entre páginas.
  - En las de resultados, el Estado tiene color: verde para Aprobado, rojo para Fallido y ámbar para No ejecutado.

## 4. Páginas con espacio en blanco notable

Se deben a que cada capítulo empieza en una página nueva o a que una captura grande no entra en el espacio que queda.

| Página (n.° impreso) | Uso aproximado | Motivo |
|---|---|---|
| 1 | 55 % | Índice. |
| 2 | 32 % | Capítulo 1, de tres párrafos. |
| 3 | 26 % | Capítulo 2, de dos párrafos. |
| 4 | 17 % | Capítulo 3, de un párrafo. |
| 8 | 6 % | Última historia del Product Backlog, antes del capítulo 5. |
| 13 | 48 % | Final del capítulo 6. |
| 18 | 56 % | La captura de US03 pasa a la página siguiente. |
| 79 | 28 % | Final del diagrama de estados de «Pasajeros», antes del capítulo 10. |

## 5. Detalles de contenido que siguen pendientes (no corregidos)

1. **Formato de los títulos de US:** US31, US36, US37, US38 y US39 usan raya «–»; el resto usa guion «-».
2. **«Epica»/«Epicas» sin tilde:**
   - En el título del capítulo 6, tanto en el índice como en el cuerpo.
   - En «Epica 6: Administración de ingresos» y en «Epica 7».
3. **«Maquina» sin tilde:** en 9.1, 9.2 y 9.3, en el índice y en el cuerpo.
4. **Otras tildes faltantes:**
   - «Registrar informacion de pago» (US32).
   - «se actualizo el indice» (historial, versión 2.1).
5. **Casos de prueba con estado Fallido o No ejecutado:**
   - US14, caso 2: Fallido.
   - US15, caso 3: No ejecutado.
   - US29, casos 1, 2 y 3: Fallido.
   - US30, casos 2, 3 y 4: Fallido.

   Conviene confirmar que se quiera entregar así.
