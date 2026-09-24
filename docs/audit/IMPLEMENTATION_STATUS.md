# Implementation checkpoint

## Séptima continuación: SEO técnico (G), 24 septiembre 2026

SEO por tienda, página, categoría y producto: canonicals locales, datos de Home y páginas reservadas, sitemap CMS basado en contenido publicado, alternates de traducciones reales, ofertas por variante, aliases 308 de páginas/productos y política diferenciada de medios comerciales/fotos de mascotas. La migración `20260924190000_seo_legacy_slugs` no se aplicó a datos reales. Guía y límites: `docs/SEO_RELEASE_CHECK.md`. G implementado en código; faltan crawl HTTP, validación de structured data y aceptación multi-tienda en staging. Siguiente bloque del plan: H, contenido y validación comercial; A–G mantienen la aceptación operativa pendiente.

## Sexta continuación: preparación de pedidos (F), 24 septiembre 2026

Se continúa en develop conservando el inicio parcial (snapshots de requisitos en web/Etsy y migración de cantidad empacada). Cola de fabricación con avance auditado por estado y tienda; empaque por línea con cantidades y asignación verificable de NFC; validación transaccional antes de READY_TO_SHIP y excepción administrativa con motivo auditado. Detalles en `docs/ORDER_PREPARATION.md`. No se aplicó la migración ni se modificaron pedidos reales. G (SEO técnico) es el siguiente bloque de código; aceptación A–F en PostgreSQL/Docker y FAQs permanecen pendientes.

## Estado actual — 24 septiembre 2026

Bloques A–E implementados en código; aceptación operativa aún pendiente en PostgreSQL/Docker y servicios de staging. Los apartados siguientes conservan el historial de cada continuación. Siguiente bloque: F, preparación y Ready to ship. F–I no iniciados aquí.

### Quinta continuación: privacidad y recuperación (E)

Inicio limpio en develop local `99e0755`, contenido idéntico a remoto `20f1fda`. Corregidos acceso directo a fotos sin política de visibilidad y consumo no condicional de password reset con revocación limitada a una tienda. Fotos ahora usan política pública del tag y excepción de propietario autenticado, consultas por tienda y no-store. Render con nueva clave de caché; URLs externas legacy no se muestran y deben reemplazarse mediante subida autenticada. PATCH de texto conserva foto y no permite sustituir su URL. Imágenes comerciales conservan su política pública.

Reset reclama token de forma condicional en transacción serializable, actualiza contraseña e invalida sesiones/enlaces de la identidad global, con auditoría. Sin nueva migración/seed. Manual y aceptación: `docs/PRIVACY_AND_ACCOUNT_RECOVERY.md`. Purga de cachés existentes y privacidad del almacenamiento requieren verificación del operador; copias ya descargadas no se revocan remotamente.

Lint/typecheck/build y 259 tests / 44 archivos PASS; git diff --check PASS. PostgreSQL real, Docker build, UI E2E y purga/CDN NOT RUN; no herramientas/servicios habilitados, credenciales ni datos reales modificados.

### Cuarta continuación: reembolsos y avisos recuperables (D)

Inicio limpio en develop local `7c2a927` y remoto `bcd1506`, árboles idénticos. Historial conservado y main sin cambios.

- Reembolso total Stripe con confirmación de pedido/importe, motivo, solicitud persistente, clave estable, consulta del proveedor y webhook firmado. Resultado incierto permanece pendiente; solicitudes de más de 20 horas o devoluciones ajenas detectadas requieren revisión sin nuevo POST automático.
- Estados de pago, preparación y devolución visibles por separado. Devoluciones parciales externas registran importe/revisión. Reposición manual auditada, basada en consumo físico y protegida contra repetición; tags no se desactivan.
- Outbox transaccional para pagos web/Etsy, cambios de estado de admin y reembolsos confirmados. Reintentos limitados, leases, errores y reenvío manual. ACCEPTED distingue aceptación de entrega; deduplicación de email depende del gateway.
- Worker existente ampliado para procesar ambas colas; operaciones de administrador restringidas a tienda/rol/origen.
- **Migración nueva requerida**: `20260924090000_refunds_and_order_outbox`. Manual: `docs/REFUNDS_AND_NOTIFICATIONS.md`. No seed/reset ni migración aplicada a datos reales.

Verificación: lint/typecheck/build PASS; 237 tests / 42 archivos PASS; git diff --check PASS. Comparación Prisma schema-to-schema confirma estructura de migración (más CHECKs SQL deliberados). Docker build, PostgreSQL real, Stripe test, email real y UI E2E NOT RUN: no herramientas/servicios habilitados en este entorno. No confundir pruebas con mocks con aceptación transaccional real. Publicación limitada a develop.

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

## Tercera continuación: stock y reservas de checkout (bloque C)

Se continúa desde develop local 7da76ba / remoto 64d11c9 (contenido idéntico, historial divergente conservado). No había cambios sin commit. Revisión detectó: cancelación sin condición atómica, ausencia de expiry/delayed-payment webhooks y stock absoluto escrito desde formulario de producto.

Implementado en código:
- Servicio de reservas, consumo y ajuste con condiciones sobre cantidades. Pago/cancelación reclaman PAYMENT_PENDING antes de modificar stock, en transacciones serializables.
- Liberación basada en ledger RESERVATION/RELEASE, independiente de cambios posteriores en trackInventory/backorderPolicy. Nuevos pedidos guardan la política original en shippingSnapshot. Backorders/Etsy preservan reservas de otros pedidos y registran consumo físico real.
- Editor de productos no escribe inventario de variantes existentes; enlace a Inventory. Ajustes explícitos comprueban expectedInventory y reservas; movimientos iniciales de nuevas variantes/productos llevan actor/motivo.
- Webhook atiende completed, async success, async failure y expired, consultando el estado actual antes de decidir. Cancelación de admin primero intenta expirar Stripe; un pago que gana la carrera se liquida y no se cancela.
- Creación Stripe con idempotency key; una excepción de red no libera a ciegas. Recuperación de vínculos por metadata/cantidad/moneda y resultados review_required/retry_required cuando faltan certezas.
- Endpoint autenticado de reconciliación paginado, script y worker Docker opcional cada cinco minutos. Requiere CHECKOUT_RECONCILE_SECRET y activación del operador; no se ha desplegado ni conectado a Stripe real.

Guía de activación y pruebas: `docs/CHECKOUT_RESERVATIONS.md`. No cambios de schema, migración o seed. Tests nuevos simulan límites de transacción, carreras y proveedores; no sustituyen pruebas de concurrencia/rollback PostgreSQL. C queda implementado en código, pendiente de aceptación operativa en staging. A/B mantienen pruebas reales pendientes. Siguiente bloque: D (pedidos/pagos/notificaciones); no iniciado en esta continuación.

Verificación final C: lint/typecheck PASS; 214 tests en 39 archivos PASS; build PASS; git diff --check PASS. Un intento intermedio falló por caché Turbopack; se apartó únicamente .next a un directorio temporal y tanto la compilación limpia como la final pasaron. Se preservó la deduplicación del webhook ya liquidado sin consulta externa, compatible con el flujo E2E simulado existente. Docker build, E2E HTTP, Stripe real y PostgreSQL real NOT RUN; no servicios/credenciales habilitados en esta sesión.
