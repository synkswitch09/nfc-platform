# Implementation checkpoint

Plan v2 aprobado para comenzar por Daniel: «comienza con el plan de implementacion en develop».

## Primer bloque: protección de contenido y cantidades

Implementado en código (validación DB real pendiente):
- Start fresh exige APP_ENV explícito development/staging; producción y entorno ambiguo fallan antes de consultar/modificar datos.
- Seed existente: si Tapkin ya existe, termina sin sobrescribir contenido, stock ni cuentas. Sirve para bootstrap inicial, no actualizaciones. No se ha ejecutado seed.
- Releases exportadas excluyen inventory/reservedInventory. Importación ignora cantidades de paquetes antiguos; variantes nuevas comienzan en cero.
- SKU existente no puede reasignarse a otro producto ni tienda mediante release.
- Secciones y traducciones se insertan por separado usando IDs de destino, dentro de la transacción existente.

## Alcance que sigue abierto

A: Docker/psql no disponibles; no backup/restauración del equipo de Daniel ni integración PostgreSQL ejecutados. No se afirma protección de sus datos por haber cambiado código.
B: allowlist y validación de referencias/assets implementadas en la segunda continuación, descrita abajo. Sigue pendiente el round-trip DB y la aceptación con Pets real. No considerar todo REC-011/014 verificado en producción.
C–I: todavía pendientes, incluyendo FAQs; ningún borrador editorial se publicó.

## Regresiones cubiertas

Tests de servicio con DB simulada: cantidades destino no escritas, nuevas variantes cero, rechazo SKU ajeno y persistencia de traducciones; guard de reset rechaza producción/ausente/inválido. No equivalen a prueba PostgreSQL ni a UI.

Validación al cierre se registra en AUDIT_PROGRESS. No migrations nuevas requeridas en este bloque. No modificar main ni reconciliar automáticamente divergencia de origin/develop.

## Uso tras actualizar esta versión

- No hace falta correr seed para aplicar estos cambios de código; sobre Tapkin existente el comando ahora informa que se omite. Para recuperar credenciales, usar el procedimiento de cuenta correspondiente, no seed.
- Un paquete de contenido no es un backup operativo. Stock se configura en la tienda destino, y no se copia al promover el diseño.
- Si cambiaste el slug de un producto y su SKU ya pertenece a otro registro del destino, el import se rechaza para conservar la asociación histórica. Resolver explícitamente el catálogo antes de reintentar.
- Restauración completa y pruebas con datos reales requieren el entorno Docker del propietario o una copia autorizada y aislada.

## Resultado de verificación del primer bloque

- Lint PASS; typecheck PASS.
- Suite completa PASS: 163 tests / 32 archivos (incluye prueba del entrypoint seed con Prisma simulado, sin tocar una DB).
- Build PASS, después de limpiar caché de Turbopack dañada en el primer intento.
- git diff --check PASS.
- Docker build, backup/restore e integración PostgreSQL NOT RUN: herramientas/servicios no disponibles aquí.
- Los cambios funcionales no requieren nueva migración. El plan A–I sigue en ejecución, no completado.

## Segunda continuación: paquetes de contenido seguros (bloque B)

Primera continuación publicada en develop remoto: `60436acc8ec73980ae63b60741266cf31ed19866`. La continuación conserva ese contenido y los commits locales existentes; no modifica main.

Implementado:
- Allowlists explícitas de campos en Store, categorías, páginas, secciones, traducciones, productos, variantes, opciones y medios. V1 se conserva; campos desconocidos de paquetes antiguos se descartan, incluidos IDs, relaciones Prisma y cantidades. Configuración de pagos, moneda, dominios, capacidades y shipping queda fuera. Asignaciones de packaging existentes se conservan.
- Preview e import rechazan referencias a categorías/opciones/imágenes ausentes, slugs/SKUs duplicados y propietarios de páginas incompatibles. Preview valida referencias **dentro del paquete**; los conflictos con registros del destino se resuelven en la transacción de importación y aún pueden causar rechazo.
- Todas las imágenes se validan antes de escribir: base64, cabecera/formato, extensión, tamaño y dimensiones declaradas; 5 MiB por imagen, 25 MiB agregados. No es una decodificación completa ni escaneo antivirus.
- Límite de 40 MiB sobre bytes realmente recibidos, incluso sin Content-Length fiable. Errores muestran la ruta del campo inválido. Admin descarta previews anteriores y recupera el estado tras fallos de red.
- Copias con clave derivada del contenido y tienda destino; reintentar el mismo paquete reutiliza bytes idénticos. URLs absolutas del servidor origen pasan a referencias locales del destino. Exportación incluye imágenes vinculadas a la página CMS de una categoría.
- DB mantiene una única transacción (timeout 60 s). Media no participa en esa transacción: si falla DB pueden quedar archivos sin referencia. No se eliminan automáticamente porque otro import concurrente puede estar usándolos. No hay atomicidad distribuida ni recolector automático implementado; no borrar archivos indiscriminadamente. Reintentar el mismo paquete reutiliza esas copias.
- Import no desvincula una página perteneciente a una categoría ni mueve imágenes de otra tienda/producto.

Uso: actualizar la aplicación, exportar desde Admin → Settings → Releases, elegir el archivo en destino, previsualizar y confirmar. No ejecutar seed ni reset. No requiere migración nueva. La importación actualiza contenido coincidente y reemplaza secciones de sus páginas; no es un backup y debe probarse primero en staging con respaldo.

Pendiente de aceptación: exportar/importar Pets con traducciones y medios en PostgreSQL aislado, repetir import, verificar stock diferente en destino y comprobar rollback real ante error. No se ha accedido a datos del usuario. Quedan pendientes A y C–I según el plan; las FAQs siguen como borradores.

Verificación de esta continuación: lint PASS, typecheck PASS, 180 tests / 33 archivos PASS, build PASS, git diff --check PASS. Docker build y aceptación PostgreSQL NOT RUN por falta de herramientas/servicios. No hay cambios de dependencias ni del esquema Prisma.
