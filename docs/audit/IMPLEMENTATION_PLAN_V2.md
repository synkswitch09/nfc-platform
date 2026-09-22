# Plan integrado v2 — operación, SEO y descubrimiento

2026-09-22 · develop @ dc80810 · PROPUESTO / NO IMPLEMENTADO.

Sustituye IMPLEMENTATION_PLAN.md como propuesta vigente, conservándolo como versión anterior. Integra los bloques A–F completos con §§183–213 de Pasted markdown(1).md. Preparar este documento no aprueba recomendaciones, código ni publicación. Backlog único: AUDIT_BACKLOG.md, REC-001..037, todos PROPOSED. El propietario puede APPROVE / REJECT / DISCUSS / DEFER por REC o bloque.

## Resultado buscado

Una plataforma simple para administrar marcas, vender productos estándar o personalizados con NFC opcional, operar pedidos de forma fiable y publicar páginas que humanos y buscadores puedan entender. Preservar diseño y contenido de Pets. No imponer “NFC” o “3D printed” en nombres/URLs, ni crear categorías por hipótesis comerciales.

## Orden integrado y dependencias

| Orden | Bloque | Recomendaciones | Criterio para avanzar |
|---|---|---|---|
| 0 | Inspección de estado y destinos | 025/026 | Rama, datos, permisos y entorno identificados |
| 1 | A. Protección y pruebas aisladas | 025/026 | Restore y fixtures comprobados o limitación registrada |
| 2 | B. Publicación de contenido segura | 011/014 | Transferencia conserva stock y contenido |
| 3 | C. Stock/reservas | 001/002 | Carreras e idempotencia verificadas en DB |
| 4 | D. Reembolsos/avisos | 003/015 | Estado externo y local conciliable |
| 5 | E. Privacidad/sesiones | 009/020 | Fotos privadas y sesiones protegidas |
| 6 | F. Preparación de pedidos | 030 | Listo para enviar exige preparación real |
| 7 | G. SEO técnico y por sitio | 024 parcial, 031–034 | Metadata/sitemap/schema/crawl consistentes |
| 8 | H. Contenido y validación comercial | 035/036, dependencias 008/010/016/019 | Oferta real, editable y sin afirmaciones inventadas |
| 9 | I. Alta y medición externa | 037 | Dominios verificados y medición sin PII |

La investigación de H puede comenzar en paralelo al análisis, sin publicar ni ampliar catálogo. E precede cualquier cambio que permita rastrear medios. B debe incluir los nuevos campos SEO que eventualmente se aprueben: no dejar configuración que no se pueda promover entre entornos. G depende del cálculo comercial y catálogo para no anunciar precios/stock incorrectos. Todos los bloques conservan el aislamiento por tienda.

Este plan amplía el primer bloque de estabilización con descubrimiento; no convierte Etsy, carrier real ni toda la reorganización del CMS en trabajo aprobado. La tabla de pendientes al final evita perder ese alcance previo.

## Bloques A–F conservados

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


## G. SEO técnico por Site, Page, Category y Product

**REC-024 (parte SEO), REC-031..034. Prioridad BEFORE LAUNCH.**

### G1. Contrato de metadata y UX simple

Reutilizar Store/StoreSettings y campos de entidad existentes. Antes de añadir columnas, fijar una fuente autoritativa por dato y cómo migrar valores legacy sin sobrescribir valores administrados. Site: nombre comercial/legal, dominio canónico validado, título/descripción default, imagen social, contacto y, cuando aplique, zona de servicio pública. Página/categoría/producto: título y descripción derivados, slug actual, imagen principal/social e indexable.

Admin: SEO title, meta description, slug, social image, indexing; Advanced para canonical override y verificación si necesaria. Mostrar valor heredado y permitir volver al default. No JSON-LD editable ni campos técnicos repetidos. El override canonical no debe poder introducir un dominio arbitrario sin validación y permiso apropiados.

Normalizar campos vacíos para que no anulen defaults. No cambiar slugs automáticamente cuando cambia un título. Verificar canonical final de FAQ, Shop, Home, Terms, Privacy, guías y páginas dinámicas: el layout declara raíz y algunas rutas no la sobrescriben. Probar HTML emitido antes de dar por reproducido el defecto.

### G2. Descubrimiento y URLs

Completar sitemap con páginas CMS/FAQ realmente publicadas, indexables y accesibles; eliminar rutas base que responden 404 según Site/capabilities. Usar modificación real, canonical y sólo idiomas con contenido disponible. Fallos DB deben ser observables, sin publicar silenciosamente un catálogo vacío como si fuera correcto.

Mantener redirecciones legacy de categorías; extender política mínima para cambios de slug en páginas y productos. Validar rutas reservadas, colisiones y ciclos. Redirección permanente a destino propio con un salto. Categorías ocultas no deben llevar a publicar tarjetas con destino inaccesible (REC-019). Revisar filtros/paginación y evitar URLs indexables por toda combinación de opciones.

NFC /t/<publicTagId> conserva identidad y seguridad. No incluir perfiles, cuentas, checkout ni URLs de activación en sitemap. Staging requiere acceso restringido además de política noindex; no abrirlo para probar crawlers públicos.

### G3. Structured data derivado

Reutilizar Organization/WebSite/Product/BreadcrumbList ya existentes. Añadir WebPage o representación de servicio sólo donde los datos públicos lo sostienen; LocalBusiness no será automático por tener dirección de despacho.

Alinear cada Offer con variante, moneda, precio comprable (incluidos cargos obligatorios), imagen y estado reales. Definir variante individual/ofertas múltiples/agrupación según contrato oficial vigente; evitar un SKU con el precio de otro y disponibilidad global engañosa. Nada de GTIN/ratings/reseñas inventados. Stock cero debe reflejarse honestamente.

Mantener FAQs visibles y editables por utilidad. Revisar marcado FAQPage existente sin prometer rich results: Google retiró esa presentación según su documentación actual. No usar schema como supuesto requisito universal de IA.

### G4. Rastreo y privacidad

Diferenciar contenido comercial, medios comerciales y fotos/perfiles personales. /api/ está bloqueado hoy: validar cómo afecta /api/media antes de permitir una ruta o crear entrega pública separada. Aplicar primero REC-009.

OAI-SearchBot corresponde a búsqueda; GPTBot es una decisión aparte. Revisar Googlebot/Bingbot y documentación pública del proveedor al implementar; WAF/rate limiting pueden bloquear aunque robots permita. No confiar en user-agent para dar acceso a información privada.

Resolver explícitamente el conflicto noindex/disallow en perfiles públicos: permitir leer noindex no autoriza publicar datos privados; no cambiar robots masivamente sin ensayo. Ninguna política elimina copias ya descargadas.

**Pruebas de aceptación de G:** dos tiendas/dominos y entornos; página publicada/oculta/noindex; filtros/paginación; URL vieja y nueva; traducción existente/ausente; HTML sin JS con title/canonical/OG/JSON-LD; cada URL sitemap responde 200 y concuerda con canonical/robots; stock cero y variantes de distinto precio/stock; imágenes comerciales accesibles, fotos privadas no; validación de datos estructurados externa al disponer de staging autorizado. No aceptar pruebas unitarias como sustituto del crawl HTTP.

**Esquema estimado:** posiblemente campos públicos de negocio/verificación tipados y alias de URL por Store; no decidir migración sin revisar reutilización del modelo existente. No aplicar migraciones en esta fase de planificación.

## H. Contenido, servicios y demanda

**REC-035/036. NOW investigación; BEFORE LAUNCH contenido de oferta activa; WHEN NEEDED servicios nuevos.**

1. Revisar exportación autorizada del contenido real de Pets; el seed no representa necesariamente tus cambios. Inventariar preguntas sin respuesta y claims que necesitan prueba.
2. Usar Page y bloques existentes para Servicio/Guía, con plantilla opcional que sólo preconfigure contenido. No nuevo editor, blog enterprise ni objeto de inventario para un servicio informativo.
3. Hacer internos los enlaces entre página comercial, guía, FAQ, categoría y producto; enlazar a secciones por IDs estables cuando el renderer lo soporte y comprobarlos. No duplicar preguntas ya administradas ni producir cientos de páginas por localidad.
4. Mantener separación nombre/valor/descripción/fabricación. Resolver la dependencia REC-008 en la presentación afectada para que un producto convencional no prometa un perfil NFC por pertenecer a una tienda NFC. No ampliar aquí a un rediseño completo de capabilities sin aprobarlo.
5. Proponer borradores sólo con hechos verificados: producto, uso, personalización, compatibilidad, materiales, cuidados, plazos, entrega y devoluciones. Una página de impresión 3D Adelaide sólo se publica si el servicio existe, con CTA de contacto/presupuesto operable. Aceptación de archivos STL con uploads requeriría alcance aparte.
6. Investigar demanda externamente antes de ampliar líneas. Plantilla de evidencia: consulta/grupo, intención, país/ciudad, fuente, fecha y período, motor/marketplace, volumen y unidad, tipo exacto/estimado/relativo, tendencia, competencia, precio comparable, coste fabricación, comisiones, envío, margen y decisión. ND si no existe dato. No inferir ventas directamente de búsquedas.

**Hipótesis a validar, no categorías a crear:** tags de mascota/personalizados, accesorios de escritorio, regalos, servicios 3D locales y productos NFC. Contrastar búsquedas de producto frente a tecnología. No afirmar que personalizados tienen más demanda sin evidencia comparable.

**Aceptación:** Daniel puede editar una página de servicio con bloques actuales y decidir su menú; enlaces funcionan; ninguna sección cambia diseño guardado de Pets; datos comerciales aprobados; documento de evidencia con fuentes separadas y limitaciones. El análisis de márgenes/competencia será investigación posterior, no una cifra inventada dentro del plan.

## H1. Ampliar la página de FAQs existente: NFC e impresión 3D — REC-035

Petición aclarada de Daniel: incorporar preguntas y respuestas de NFC e impresión 3D en general, además de productos, perfiles y servicios de Tapkin. No crear otra página de FAQs. Usar /faq y su agregación actual de preguntas generales y de Pets.

Entregable editorial: [FAQ_CONTENT_PLAN.md](FAQ_CONTENT_PLAN.md), con 50 respuestas propuestas, 16 preguntas iniciales pendientes y una matriz adicional de temas técnicos/comerciales por validar. Incluye NFC/QR, activación, perfiles, privacidad, impresión 3D, materiales, archivos, diseño, personalización, variantes, fabricación, cuidados, presupuestos, entrega y soporte. Agrupar con módulos FAQ existentes y mostrar sólo lo pertinente en cada Site.

Antes de cargar: comparar preguntas del dataset real y preservar ediciones; reutilizar preguntas Pets en la agregación general, sin copiarlas. Las respuestas sobre capacidades pendientes sólo se publican tras su prueba. Daniel mantiene edición, orden y visibilidad desde el Admin existente. No inventar resistencia al agua, compatibilidad universal, tarifas, garantía ni suscripción gratuita.

Dependencias: REC-009 para privacidad/foto; validación de flujos de activación/LOST; políticas comerciales y especificaciones de producto. Publicación en inglés australiano para el storefront actual, con traducciones posteriores mediante el CMS existente. La carga será idempotente, por tienda y sin seed/reset. Criterios completos en el documento editorial.

## I. Buscadores y medición ligera

**REC-037. Preparación BEFORE LAUNCH; seguimiento AFTER LAUNCH.**

Preferir verificación DNS de Search Console y Bing fuera del CMS. Si hace falta HTML verification, guardar sólo token validado por Store, no scripts arbitrarios. Enviar sitemap después de validar dominios y producción; no se envían URLs en este turno.

Configurar herramienta externa de analytics con eventos de producto/checkout/compra sin PII ni publicTagId, y deduplicación de compra. Revisar semanalmente al inicio consultas, impresiones, clicks, CTR, posición, landing y conversiones; referidos IA sólo cuando identificables. Revisar mensualmente contenido y oferta según evidencia. Esta es una cadencia propuesta, no una automatización creada.

IndexNow opcional si compensa por frecuencia de cambios; no bloquea lanzamiento. Un 200 de envío no demuestra indexación. No construir panel SEO interno.

**Aceptación:** propiedad de cada dominio verificada, sitemap comprobado, evento de prueba contado una vez, separación de marcas, ausencia de datos personales, runbook de revisión. Acceso externo ausente implica NOT RUN, no falso éxito.

## Límites y evidencia de buscadores

Las reglas y fuentes están en FINAL_AUDIT, sección SEO / AI SEARCH / MARKET DISCOVERABILITY (consulta 2026-09-22). Diferenciar requisitos confirmados, buenas prácticas y experimental. No garantía de ranking, ventas ni citas IA. No llms.txt como requisito, páginas artificiales, reseñas falsas ni datos estructurados inventados.

## Pendientes del roadmap general, preservados

| Área | REC | Relación con este plan |
|---|---|---|
| Etsy completo | 005/006/007/012/028/029 | Plan posterior; necesario antes de activar esa integración real |
| Australia Post / shipping admin | 004/013 | Plan posterior o circuito manual explícitamente aceptado y probado |
| Impresión automática | 022 | Plan posterior con impresora física y prueba de ACK/reintento |
| Capabilities por sitio/producto | 008 | Dependencia acotada de F/H; alcance completo pendiente |
| Home/cards/UX | 010/016/017/018/023/027 | Preservar; corregir bloqueo concreto para contenido sólo dentro de alcance aprobado |
| Catálogo y visibilidad | 019 | Dependencia G; no redefinir oferta sin aprobación |
| Retención/EXIF | 021 | Pendiente; E no implica resolver toda retención |
| Idiomas | 024 parte i18n | Evitar alternates falsos ahora; traducción completa posterior |

## Validación, migraciones y recuperación

Conservar 24 migraciones existentes; cambios nuevos aditivos donde sea posible. Probar DB vacía aislada y actualización de esquema previo. Paquetes de contenido no incluirán secretos, tokens de verificación de otro dominio, inventario ni clientes; mapear sólo datos aprobados del sitio destino. No copiar configuración de producción a staging sin adaptar host/indexación.

En cada bloque: reproducir fallo, cambio mínimo, prueba relevante, diff y documentación; commit/push develop sólo conforme a autorización vigente. Nunca main, force push ni reescritura de historia. origin/develop local figura ahead30/behind24; comprobar remoto y árboles antes de publicar, sin reset automático.

Cierre: lint, typecheck, tests, build, PostgreSQL integrado, E2E y navegador, Docker runner/migrator y crawl SEO. Pruebas test de Stripe/email; no dinero real ni correos a clientes. Build verde no significa integración ni SEO comprobados. Auditoría anterior: 151 tests/30 archivos, lint/typecheck/build PASS; DB/Docker/runtime no comprobados. Esta revisión es documental y no los repite.

Rollback: backup verificable previo; import DB atómico; no borrar archivos originales; volver sólo a imagen compatible; no restaurar sobre ventas posteriores ni revertir esquemas destructivamente. Conciliar efectos externos inciertos.

## Aprobación y siguiente acción exacta

Estado actual: documentación ampliada, aplicación y DB intactas, sin commit/push. Primero Daniel clasifica el plan/recomendaciones. Sólo tras aprobar implementación: volver a inspeccionar git y disponibilidad del entorno; comenzar A. No afirmar que se ha respaldado su Docker local sin acceso real. Detenerse en esta fase de planificación conforme al §212 del adjunto.

## Inicio autorizado

Daniel autorizó comenzar en develop. La autorización posterior reemplaza las indicaciones anteriores de esperar aprobación para los bloques de este plan. Avance y límites verificables en IMPLEMENTATION_STATUS.md; recomendaciones no se marcan completas por mera aprobación. No confundir implementación local con despliegue o backup del Docker del propietario.
