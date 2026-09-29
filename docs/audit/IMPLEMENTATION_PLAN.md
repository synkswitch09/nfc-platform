# Plan de implementación — protección de datos, venta y operación

Fecha: 2026-09-22. Base revisada: develop @ dc80810.
Estado: PROPUESTO, pendiente de aprobación del plan. El «hazlo» autoriza preparar este documento; no ejecutar cambios funcionales ni publicar.

## Alcance y decisiones

Este es el primer bloque recomendado (puntos 1–3), no una reimplementación de la plataforma. Incluye REC-001, 002, 003, 009, 011, 014, 015, 020 y 030, con REC-025 y 026 como validación y protección operativa acotadas. Las recomendaciones del backlog conservan PROPOSED; seleccionar para planificación no equivale a aprobar su ejecución.

Preservar Pets, imágenes, textos, estilos, productos, historial y tags. No ejecutar seed/reset sobre datos administrados. No trasladar stock, pedidos, clientes, sesiones ni secretos al publicar contenido. Mantener categoría, producto y tag independientes. Mantener funcionamiento de productos sin NFC.

Todo trabajo posterior será en develop, por bloques revisables. No modificar ni fusionar main. La referencia local origin/develop presenta divergencia histórica (30 ahead / 24 behind): antes de publicar, comprobar remoto y árboles de contenido; nunca forzar push, resetear ni reescribir historia para resolverla automáticamente. Este plan no autoriza despliegue ni operaciones monetarias reales.

## Secuencia de ejecución

### A. Protección y banco de pruebas — REC-025, 026

**Objetivo:** poder demostrar cada corrección sin arriesgar la configuración del negocio.

- Inventariar en modo lectura el destino Docker, volúmenes, entorno y versiones; comprobar acceso antes de asumir que esta sesión ve el equipo de Daniel.
- Adaptar los scripts existentes de backup/restore para seleccionar un destino inequívoco. Crear una copia consistente de DB y uploads, coordinando la pausa de escrituras; guardar checksums y versión del esquema. El backup actual copia ambos por separado mientras la aplicación puede escribir.
- Restaurar únicamente en PostgreSQL y volúmenes aislados; bloquear correos reales, Stripe live, Etsy y workers externos en esa copia. No usar el restore actual contra el Docker original: reemplaza DB y uploads.
- Preparar fixtures mínimas de dos tiendas, dos clientes, variantes, pedidos y perfiles. Las pruebas repetibles usarán fixtures sintéticas; no volcar datos personales al repositorio.

**Aceptación:** restore completo verificable; Pets conserva contenido, referencias e imágenes; un tag conocido funciona en la copia; ninguna escritura ni comunicación externa desde el ensayo afecta al origen. Integración con PostgreSQL ejecutable y fallo seguro si el destino no es de prueba.

**Dependencia:** acceso al Docker que contiene el trabajo real para respaldarlo. La auditoría no encontró docker/psql ni DATABASE_URL en esta sesión. Si sigue así, avanzar sólo en código/pruebas disponibles y registrar el ensayo como pendiente, nunca como aprobado.

### B. Publicación de contenido y arranque seguros — REC-011, 014

**Módulos:** lib/storefront-release.ts, tests/storefront-release.test.ts, prisma/seed.ts, lib/store-reset.ts y APIs correspondientes.

- Separar explícitamente configuración/contenido de datos operativos mediante allowlist y versión del paquete. Excluir inventory y reservedInventory, relaciones de ventas y credenciales.
- Importar secciones y traducciones mediante operaciones compatibles con Prisma; resolver referencias dentro de la tienda destino. Validar todo antes de aplicar y asegurar atomicidad de la parte DB.
- Validar transferencia/disponibilidad de archivos: una URL local de desarrollo no cuenta como imagen publicada. Previsualizar cambios y referencias faltantes; no declarar éxito con archivos ausentes.
- Mantener stock y reservas de variantes existentes; crear variantes nuevas con stock cero. Reimportar el mismo paquete sin duplicaciones.
- Separar bootstrap mínimo no destructivo de datos demo/reset. Mantener bloqueo de seed en producción y bloquear Start fresh allí por defecto. Arrancar la imagen Docker no ejecutará seed.

**Aceptación:** round-trip real de Pets con secciones, traducciones e imágenes; destino conserva cantidades distintas de las del origen; doble import no duplica; paquete inválido no deja cambios parciales; repetir bootstrap no republica categorías ni borra ediciones. No tocar pedidos ni tags existentes.

### C. Stock y reservas del checkout — REC-002, 001

**Módulos:** lib/order-service.ts, APIs admin de inventario/producto y webhook Stripe.

- Centralizar los ajustes, reservas y liberaciones transaccionales, manteniendo constraints SQL y trazabilidad del movimiento, motivo y actor.
- Proteger transiciones con condición sobre estado/version; un segundo intento de cancelación será inocuo. Evitar que el editor de producto sobrescriba cambios concurrentes de stock.
- Liberar reservas ante expiración/fallo confirmado aplicable; añadir reconciliación programada recuperable para eventos perdidos. El retorno a cancel_url no demuestra que el pago esté cancelado.
- Ante pago y expiración simultáneos, decidir usando estado confirmado del proveedor y transición atómica. Un estado externo incierto queda pendiente de revisión, sin liberar inventario a ciegas.
- Reutilizar mecanismos existentes de tareas/autenticación cuando sirvan; no introducir un broker nuevo.

**Aceptación PostgreSQL:** dos compradores disputando la última unidad; doble cancelación con otra reserva válida; pago simultáneo a expiración; webhook duplicado/desordenado; caída antes/después de confirmar transacción; ajuste admin concurrente. Sin stock negativo, liberaciones ajenas ni pago confirmado perdido. Probar aislamiento entre tiendas y rechazar firma/importes no válidos.

### D. Reembolsos y avisos recuperables — REC-003, 015

**Módulos:** lib/order-status.ts, lib/order-service.ts, lib/order-notifications.ts y admin de pedidos.

- Añadir reembolso total con confirmación que muestre pedido e importe, motivo e idempotencia persistente; conciliación con resultado del proveedor y webhook. No marcar REFUNDED antes de confirmar éxito.
- Mostrar separadamente estado del pago, preparación y reembolso. Reponer stock será una decisión explícita y registrada, sin automatizar devoluciones de productos personalizados o enviados.
- No desactivar un tag vendido por el mero reembolso. Revisiones de propiedad/abuso siguen su propio flujo.
- Guardar notificaciones pendientes junto al evento de negocio; procesar con reintentos limitados, último error visible y reenvío administrativo. Distinguir aceptación del proveedor de entrega real al destinatario.
- Tras respuesta incierta del email, usar deduplicación del proveedor si existe; no prometer entrega exactamente una vez si el proveedor no la soporta.

**Aceptación:** doble clic y reintento no duplican devolución; timeout se reconcilia; fallo no marca devolución exitosa; webhook de devolución externa actualiza estado; una reposición ocurre una sola vez. Email caído no impide registrar pago y vuelve a intentarse; ningún pedido de otra tienda es accesible.

**Límite:** reembolso parcial y operaciones Etsy fuera de este bloque. Si Stripe informa uno parcial, conservar el importe y mostrar revisión pendiente sin convertirlo falsamente en reembolso total. Pruebas monetarias sólo con Stripe test.

### E. Privacidad de fotos y recuperación de cuenta — REC-009, 020

**Módulos:** API media, subida de foto, perfil público, reset-password y sesiones.

- Aplicar a las fotos de mascota las mismas reglas de visibilidad y estado que al perfil público, con acceso autenticado para su propietario. Mantener públicas las imágenes comerciales destinadas a ello.
- Eliminar caché pública immutable en medios restringibles y validar autorización en cada acceso. Considerar nueva URL/version y purga donde exista CDN; una copia ya descargada no puede revocarse remotamente.
- Consumir token de reset de forma atómica. Al cambiar la contraseña global, invalidar todas las sesiones del usuario, incluso de otras tiendas, sin cambiar la identidad compartida existente.

**Aceptación:** visitante, propietario, otro cliente y otra tienda; perfil público/privado y estados permitidos/no permitidos; petición directa a URL antigua y cabeceras de caché. Dos usos simultáneos de un token: sólo uno válido. Ninguna sesión anterior sigue activa después del reset.

### F. Preparación y Ready to ship — REC-030

**Módulos:** lib/manufacturing.ts, cola admin de fabricación, API de pedidos y datos históricos de líneas.

- Permitir avanzar ManufacturingJob con acciones claras y permisos por tienda, usando la estructura existente.
- Mostrar datos de compra guardados en la línea, no atributos actuales que el catálogo puede haber cambiado. Para registros antiguos sin snapshot suficiente, señalar que falta información en vez de inventarla.
- Checklist mínimo por línea: producto/variante, cantidad, personalización y comprobación NFC sólo cuando corresponda. No imponer NFC ni fabricación 3D a productos estándar.
- Habilitar Ready to ship cuando las líneas estén preparadas. Cualquier excepción administrativa tendrá motivo y registro; nunca pasar automáticamente de pagado a listo.

**Aceptación:** pedido básico, personalizado, con NFC y sin NFC; cantidades múltiples; producto editado después de vender; job de otra tienda; doble clic. Pedido incompleto bloqueado con explicación concreta y pedido preparado puede avanzar.

**Límite:** esto no compra franqueo. Australia Post directo, impresión automática y CRUD completo de shipping quedan pendientes. Si se decide lanzar antes, validar previamente el circuito de tarifa manual, compra de etiqueta en el portal y tracking. No presentar MOCK como etiqueta válida.

## Cambios de esquema y recuperación

Determinar las migraciones mínimas al implementar: primero revisar si las entidades actuales cubren idempotencia, versión/lease, importe reembolsado y avisos persistentes. Preferir ampliaciones compatibles; no eliminar modelos ni reescribir migraciones existentes. Probar migración desde un esquema previo y desde DB vacía aislada.

Antes de cada cambio de datos real, backup y destino verificado. Fallos de import DB deben revertir su transacción; archivos preparados se limpian sin borrar originales. Ante fallo de despliegue, volver a una imagen compatible con el esquema; no ejecutar automáticamente migraciones destructivas inversas ni restaurar una DB sobre ventas posteriores. Registrar y conciliar operaciones externas inciertas.

## Verificación y entrega por bloque

1. Reproducir el problema relevante con fixture y comprobar comportamiento actual.
2. Implementar cambio mínimo y prueba de regresión significativa.
3. Revisar diff, permisos, aislamiento y compatibilidad; actualizar manual operativo.
4. Ejecutar pruebas del módulo. Si falta DB/proveedor/hardware, conservar explícitamente NOT RUN y criterio abierto.
5. Commit coherente en develop después de aprobación de implementación. Publicación sólo según autorización vigente y comprobación del remoto; no force push.

Al cerrar: npm run lint, npm run typecheck, npm test, npm run build; integración PostgreSQL; E2E HTTP aislado; navegador móvil/escritorio en compra, admin y perfil; Docker build/runner/migrator cuando esté disponible. Guardar resultados nuevos, no reutilizar los de la auditoría como evidencia de correcciones.

La auditoría anterior pasó 151 tests/30 archivos, lint, typecheck y build; eso no acredita aún los escenarios de concurrencia ni el Docker del usuario. Este turno sólo prepara documentación: no vuelve a ejecutar pruebas de aplicación sin cambios funcionales.

## Fuera de este primer plan

Etsy completo (REC-005/006/007/012/028/029), API Australia Post (REC-004), CRUD shipping (REC-013), print agent (REC-022), reorganización CMS/cards, capabilities de sitio y traducciones siguen pendientes. Este bloque reduce riesgos, pero no equivale a terminar toda la plataforma ni aprobar un lanzamiento con esas integraciones activas.

## Checkpoint y aprobación

Documento preparado; ninguna funcionalidad implementada ni datos modificados. No se hizo commit, push, merge, seed, migración ni llamada de pago. El plan se presenta para aprobación según la instrucción de la auditoría de separar recomendaciones, plan e implementación.

Siguiente acción exacta tras aprobación: inspeccionar git y entorno; comenzar A con destino aislado verificado; si no se dispone del Docker de Daniel, no afirmar que se respaldaron sus cambios. Mantener checkpoint por bloque con tests y criterios pendientes. No abrir el bloque Etsy/CMS automáticamente.

## Versión posterior
Propuesta vigente ampliada: IMPLEMENTATION_PLAN_V2.md (2026-09-22), incluye SEO/AI Search §§183–213. Este documento se conserva como historial; no está aprobado para ejecución.
