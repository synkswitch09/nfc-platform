# Auditoría integral — informe consolidado

**Fecha:** 2026-09-22. **Checkout:** develop @ dc80810. **Alcance:** revisión estática y pruebas locales; validación integrada/visual pendiente por entorno. Este informe no certifica producción ni equivale a una implementación.

## 1. Executive Summary

La base es un monolito de comercio y contenido con NFC opcional a nivel tienda, no una plataforma únicamente NFC. Tiene una cantidad importante de funcionalidad real y pruebas locales verdes, pero **no está lista para certificar producción integral**. Los bloqueos principales son integridad de reservas/stock, releases que transportan datos operativos, refunds ausentes, cola Etsy y contratos API incompletos, privacidad media y operaciones shipping/producción sin controles completos. No se identificó un P0 confirmado; hay riesgos P1. No dar porcentaje de completitud: confundiría helpers probados con integraciones reales. El owner puede editar catálogo/contenido y gestionar estados, pero aún depende de intervención técnica o portales externos para varias operaciones frecuentes.

## 2. What The Platform Currently Is

Next.js App Router + React, Route Handlers, Prisma/PostgreSQL, Stripe, storage local/Azure, email webhook, Etsy y agente local PDF. No hay worker separado desplegado en compose; Etsy requiere llamada programada externa al endpoint. No existe API real AusPost detrás de la interfaz. Se observaron 57 modelos Prisma y 24 migraciones. Baseline local dc80810 en develop.

## 3. Existing Product Intent

Preservar diseño Pets y edición existente; plataforma propia para marcas distintas; compra estándar y personalizada independiente de identidad NFC. Documentación histórica refleja fases anteriores y no acredita estado actual. No se ejecutó start fresh, seed ni import. La auditoría sólo añade estos ocho documentos.

## 4. Current Architecture

Conservar monolito modular. Servicios order/shipping/fulfilment/etsy delimitan operaciones; varios endpoints todavía contienen transacciones y políticas duplicadas. El problema central es coherencia entre escrituras, no necesidad de microservicios. Separar frontend/render, validación, política y operación transaccional sólo donde ya hay duplicación.

## 5. Domain Model

Store→Category→Product→Variant; Variant inventory/reserved; Order→OrderItem→Payment/Shipment; MarketplaceConnection/Listing/Order/Job; NFCTag→Owner/TagProfile y perfiles especializados. Category nullable en DB pero requerida por venta. Store es Brand/Site mínimo suficiente; no agregar entidades nuevas por nombre conceptual. Direcciones/usuarios globales merecen decisión explícita.

## 6. Multi-Site / Multi-Brand

Host+environment resuelve Store; sesiones, catálogo, contenido, órdenes y media se filtran. ADMIN es platform global; STAFF necesita membership. SKU global único: protege mapping pero impide repetir SKU por marca. Catálogo compartido no implementado; no se necesita hasta segundo caso real. paymentProfileKey existe pero getStripe usa config global: no prometer pagos separados por marca. Fuente: lib/storefront.ts, lib/admin.ts, lib/stripe.ts, schema.

## 7. Site Capabilities

Consultar SITE_CAPABILITIES_AUDIT. REC-008: faltan accounts y managed products independientes. Cambiar navegación no sustituye feature guard. Conservar acceso a perfiles ya emitidos al archivar categoría; resolver explícitamente qué significa apagar NFC con clientes existentes.

## 8. CMS Architecture

ContentPage y LandingPageSection con JSON tipado y traducciones. Buen límite: no HTML/JS libre. Home/category legacy siguen siendo otra fuente, y parse inválido puede ocultar bloques. REC-010/023/027. No migrar a otro CMS: corregir persistencia y simplificar el editor actual.

## 9. Admin Usability

Agrupación Catalog/Sales/Content/System es razonable. NFC contiene producción 3D genérica y hasta enlace Tags en tienda sólo PRINT_3D: reorganizar por tarea. Shipping/Manufacturing anuncian funciones cuya edición no está completa. Producto tiene feedback por campo, pero unidades de error numérico dicen characters. Flujos y clicks estimados más abajo.

## 10. Home / Sections

15 tipos y operaciones add/hide/order/duplicate/delete reales. Abrir editor vacío lo repuebla y publica; esconder todas las secciones activa fallback público. REC-010. Un Home configurado vacío debe distinguirse del legado no migrado.

## 11. Card System

Inventario y mapa en CARD_SYSTEM_AUDIT. PRODUCT_SHOWCASE y PRODUCT_GRID son duplicados actuales. Propuesta 8 contratos semánticos, manteniendo layouts como variantes. No unificar Profile/Order/Product. No agregar Testimonial sin uso.

## 12. Themes

Cinco familias pastel: peach, blue, green, lilac, butter con negro/blanco y overrides. Nombres internos CORAL/SKY/MIDNIGHT/VIOLET/AMBER son compatibilidad, labels ya son pastel. Mantener paleta completa; preset no restringe colores. No renombrar DB sólo por estética.

## 13. Typography

Inter cargado por next/font/google, 100/300/400/500/700/900, italic y px8–96 en contratos. Header aún tiene defaults globales y overrides específicos. No garantizar exact px en perfil: clamp h1 limita mínimo; REC-018. El editor debe mostrar valor heredado/override y reset, sin repetir el mismo campo en paneles distintos.

## 14. Header / Footer

Header permite categorías, custom links, páginas y FAQ, menús responsive, acciones. Account se presenta con commerce siempre; falta control independiente. Footer administra textos/enlaces/social images; no falta crear upload social desde cero. Validación visual y contraste aún pendientes. Ver components/site-header.tsx/site-footer.tsx y storefront-chrome-form.

## 15. Pages / FAQs

Custom pages tienen tipo/placement header/footer; legales sin registro real aparecen como DEFAULT en lista, no como contenido persistido. FAQ combina secciones visibles de categorías y FAQ general con deduplicación por pregunta/respuesta; fuente legacy puede reintroducir contenido. Probar ocultar todos/editar heading/traducción/refresh con datos reales antes de certificar.

## 16. Media

Validación firma/tamaño/dimensiones, claves seguras, storage por entorno/store. Delete general limpia referencias CMS y varias columnas en transacción; borrado físico puede fallar silenciosamente. No hay sistema unificado de assets para catálogo+perfil. Separar privacidad de perfil de imágenes marketing, REC-009/021.

## 17. Categories

Identidad/visibilidad y lifecycle separados del tag. Delete policy conserva historial al requerir mover productos. Tags vendidos no dependen de categoría publicada: correcto. Número de categorías efectivas del Docker del usuario UNKNOWN; sólo se inspeccionó código/seed.

## 18. Products

CRUD/duplicado/archivado, SEO, shipping y opciones existen. Edit general escribe inventory sin InventoryMovement; CHECK DB protege límites pero UX es genérica ante constraint. Política categoría opcional difiere de venta. REC-002/019.

## 19. Variants

Colour con hex/swatch image, size y style via optionSelection; material/colour/size también columnas. UI tiene selector general Style más opciones: puede confundir configuración vs combinación. Gallery usa imagen variante/color/generic. Opciones no disponibles producen mensaje; no siempre se deshabilitan anticipadamente.

## 20. Personalization

NONE/OPTIONAL/REQUIRED y elección BASIC/PERSONALISED están separados en cart/order y validados servidor. Campos texto/select/radio/check son reales. IMAGE sólo TO_BE_CONFIRMED y aviso postcompra: no es flujo de upload de personalización. No habilitarlo como completo sin operación de recogida/validación.

## 21. Standard Products

ACCESSORY permite comercio sin tag; el checkout no crea NFC. Sin embargo, la tienda NFC imprime mensajes de perfil en cualquier producto por connected=store.NFC. REC-008. En tienda PRINT_3D todos los pedidos crean jobs aunque producto no requiera fabricación.

## 22. Personalized Products

Snapshots de contenido/precio presentes. Fabricación lista opciones pero usa también nombre/material/color actuales y stringify de objetos puede mostrar [object Object] para Etsy. Debe preparar desde snapshot y mostrar contenido personalizado de forma legible; REC-007/030.

## 23. NFC Products

Compra guest separada de activación autenticada: base adecuada. ProductType mezcla propósito/perfil/comercio. Agregar capability concreta donde falta, sin enum gigante ni cambiar todas las categorías existentes.

## 24. Inventory

available=max(0,inventory-reserved), reservas por variante y movimientos. CHECK SQL inventory>=reserved>=0, precios no negativos. Reservas pueden quedar colgadas; doble cancelación y ajustes tienen carreras; no afirmar que falta constraint. Stock multicanal eventualmente consistente, no garantía de cero oversell.

## 25. Cart

Cliente localStorage por tienda; guarda customización y precios de presentación, servidor vuelve a validar. Tablas Cart/CartItem parecen legacy de core; no quitar sin mapa de usos. No hace falta carrito cross-device antes de ventas.

## 26. Checkout

Cotiza con token hash 15min, valida cart/address y consume una vez. Crea order/payment y reserva antes de Stripe. Falta expiración y cierre robusto cuando sesión externa se crea pero attach falla. Firma/payment matching correctos; no confundir con reconciliación completa. REC-001/002/003.

## 27. Guest Checkout

Implementado; success link con claim token y claim autenticado/verificado por email. No exigir cuenta para comprar NFC; sí para claim/manage. Repetir E2E con stock disponible en DB desechable.

## 28. Customer Accounts

Cuenta global, memberships y sesiones por Store. Recuperación cambia password global pero no revoca sesiones de otras tiendas, REC-020. Apple/Google tienen OIDC/state/nonce/PKCE pero no credenciales reales verificadas. No prometer autenticación externa operativa sólo por código.

## 29. My Products

Owner tag details con foto/editor/lost/QR; restricciones owner+store. Grid inline no se adapta con la regla CSS móvil normal. QR URL trunca correctamente; no deshacer última solución por culpa del contenedor padre. REC-017.

## 30. Customers

Consulta por membership tienda, estado modifica User global por ADMIN global. Aclarar alcance en pantalla; direcciones son User global. Listado take200 sin paginación, apropiado sólo al principio; no CRM enterprise.

## 31. Orders

Snapshots directos conservan precio/SKU/nombre/tipo/personalización/shipping y address; status history. sourceDomain y MarketplaceOrder identifican Etsy, sin necesidad de mega SalesChannel. Falta manual order y devoluciones; priorizar refunds antes que creación manual si no se usa.

## 32. Payments

Stripe server-only, firma webhook y comparación order/store/session/importe/divisa; eventos idempotentes. Sólo checkout.session.completed; async/expired/refunds ignorados. Si se permiten métodos diferidos, documentar y cubrir estados. No pruebas live ni afirmación de conciliación bancaria.

## 33. Refunds

MISSING operativo. Enum REFUNDED no tiene transición ni llamada provider. Recuperación/reembolso externo puede ser alternativa inicial, pero se necesita reflejar resultado y restock explícito. REC-003.

## 34. Shipping

Origen/zone/rate/package/snapshots separados. Manual rates realmente funcionan por configuración; coste no deriva de postage real. Dimensiones faltantes usan 100g/100×100×30mm; conviene validar readiness de publicación para no ocultar errores. Empaque suma alturas/max dims, no certifica cabida física.

## 35. Packaging

Paquete variante→producto→primer activo del store; maxWeight se verifica. Elección de origen por default/createdAt, suficiente para uno. Admin read-only en origin/package/rates bloquea operación diaria. REC-013; un origen, pocos paquetes y confirmar medidas bastan.

## 36. Australia Post / MyPost Business

No integración ejecutable: adapter AUSTRALIA_POST lanza error y labels sólo MOCK. El portal oficial distingue Shipping & Tracking de otras APIs; eParcel Contract y MPB no son cuentas intercambiables. Confirmar elegibilidad/credenciales con Australia Post; documentación MPB específica no quedó verificada con detalle por contenido dinámico del portal. No recomendar tercero obligatorio ni prometer API gratis. Referencias oficiales abajo.

## 37. Shipping Labels / Printing

PDF generado es local MOCK. Print Agent descarga documento autorizado por lease y ejecuta comando sin shell; buen límite. Falta confirmar franqueo real/formatos y prueba de impresora. No ZPL ahora si PDF sirve; evitar declarar exactamente-once físico. REC-022.

## 38. Fulfilment

PAID→PROCESSING→READY_TO_SHIP→SHIPPED→DELIVERED→COMPLETED existe. Shipping manual pide carrier/tracking. No valida trabajo pendiente ni vínculo tags/orden al marcar listo; job genérico no tiene API de avance. REC-030. Implementar checklist, no proceso industrial completo.

## 39. Notifications

Email cliente y supportEmail de tienda al pagar, y estados operativos; errores descartados y sin outbox. Debe mostrar failed/pending/sent y permitir reintento. No construir automatizaciones marketing. REC-015.

## 40. Etsy

Conexión OAuth, token AES-GCM, draft listing, imágenes, mapping SKU, inventory/price/title/description, receipts pagados. Contrato tercera variante requiere max_variations_supported=3, omitido. No sync tracking; deltas opciones no incluidos en precio enviado. No prueba real ni garantía de listing completo. REC-005/006/007/012/028/029.

## 41. Sales Channels

Core Order/Variant propios, Etsy encapsulado en tablas marketplace y lib/etsy: conservar. Conexión por tienda; callback usa APP_URL global, comprobar multidominio antes de segunda marca. Scope actual carece transactions_w. No ampliar a marketplaces no pedidos.

## 42. NFC Lifecycle

MANUFACTURED/UNCLAIMED/ACTIVE/LOST/DISABLED/REPLACED y manufacturingStatus separados. Activación atómica y código separado de URL, correcto. Replacement sólo estado, sin successor/ownership transfer/recovery guiados: PARTIAL; operación de soporte manual hasta acordar necesidad.

## 43. Public Profiles

Public resolver verifica estado/profile isPublic, no categoría/product status. Pet card contiene foto/contactos/notas; terceros verán los datos rellenados. No hay per-field privacidad. Foto vía media no respeta esa política. REC-009. Necesita inspección real de foto tras upload/disable.

## 44. Lost Mode

Owner ACTIVE↔LOST con audit y aviso público; control está en detalle tag. Color configurado erróneamente afecta tarjeta médica, REC-018. Recuperar vuelve ACTIVE. No GPS; geolocalización compartida sólo con acción de visitante.

## 45. QR

QR y NFC abren misma URL aleatoria; copiar URL funciona en card. Ningún QR estático impide duplicación física; no recomendar criptografía hardware sin amenaza real. Mantener activation code separado del enlace público.

## 46. Database

57 modelos,24 migrations, FKs/indexes/unique/checks. User shared y Store scoping por aplicación, no RLS. FK simples no garantizan que dos entidades relacionadas pertenezcan al mismo store; rutas verifican muchos casos, imports passthrough requieren mayor rigor. Historical restrict/select soft archive razonables; no soft delete universal.

## 47. Security

Contraseñas bcrypt12, HMAC activation, tokens hash, cookies httpOnly/sameSite, nonce/PKCE, CSRF origin en mutaciones, Stripe signature, URLs controladas y React text. Hallazgos: media privacy, reset concurrente/sesiones globales, import contrato permisivo. CSP production permite unsafe-inline; mejorar defensa después de flujos críticos. Rate limit count+insert no atómico; TRUST_PROXY=false agrupa usuarios bajo untrusted-proxy. Validar ingress y límites por identidad, no asumir protección de red.

## 48. Privacy

Contactos/perfil de menores/salud deben tener política clara y revisión legal especializada antes de uso real. No se emite dictamen legal. Minimizar externalData Etsy, EXIF y retención logs/claims; cache un año incompatible con revocación perfil. Pet no equivale a ausencia de PII: dueño/teléfono sí son personales.

## 49. UX/UI

Mejorar lo frecuente: editar contenido/campo en un solo grupo, feedback field/unit correcto, save/error visible, neutral commerce labels para productos normales. No decir que se probó diseño: sólo código y capturas históricas. Pendientes mobile/profile/Shop/Admin reales.

## 50. Accessibility

Bases: labels, buttons/links, details/summary, alt y swatch aria-pressed. Riesgos: color libre sin contraste, tamaños mínimos8px, posible jerarquía h1 por bloques, menú/foco y colapso. Auditoría manual teclado/screen reader no ejecutada. No certificación WCAG.

## 51. SEO

Metadata, canonical, JSON-LD escaping <, noindex perfiles/admin y entornos; buenas bases. Sitemap no incluye ContentPage/custom FAQ, REC-024. Locale alternates no garantizan traducciones reales. No construir suite SEO enterprise.

## 52. Internationalization

es-CO/en-AU disponibles, CMS pages/sections tienen traducción. Precio/formularios/perfil/Admin/email inglés fijo y formato en-AU. Declarar alcance real; una sola lengua completa sirve para lanzamiento australiano.

## 53. Performance

Imágenes mayormente unoptimized, payloads de formularios extensos, listados algunos con take200; media reads completo. No métricas LCP/INP/query plan. Evitar caché agresiva de perfiles; optimizar imágenes y paginar cuando importe. No justificar Redis/microservicios por conjetura.

## 54. Testing

Lint/typecheck/151 tests30 archivos/build PASS en esta ejecución. Muchos tests son helpers/schema; multistore tests no recorren todas rutas. CI incluye PostgreSQL migrations/seed/http E2E y Docker build, pero su ejecución actual no se verificó. Docker/psql ausentes, DATABASE_URL no configurada. No corrió test:e2e porque muta datos y falta DB aislada. REC-025.

## 55. DevOps

Docker multi-stage non-root/tini, migrator separado, volúmenes DB/uploads. Compose fuerza development/mock email: no es config prod. CI construye imágenes SHA y despliega Azure con smoke; validar CLI migration job/permissions en staging. Backups DB+media existen pero sin freeze consistente ni ensayo restore demostrado. REC-026.

## 56. Integrations

Stripe parcial; email webhook necesita proveedor real; Google/Apple código sin cuenta validada; Etsy parcial; AusPost missing. AddressAutocomplete sólo ManualAddressProvider: manual entry es suficiente inicialmente, no prometer autocompletado. Credenciales deben seguir configuración técnica, no dispersarse por CMS.

## 57. Technical Debt

Ver TECHNICAL_DEBT. Prioridad es invariantes de stock/órdenes, operación jobs y releases antes de reducir líneas de CSS o renombrar tipos.

## 58. Overengineering

Demasiados controles visuales equivalentes y fuentes legacy; modelos/estados sin operaciones completas. No destruirlos ahora: reducir UI/políticas duplicadas primero. Print Agent puede esperar si PDF/browser satisface volumen inicial.

## 59. Simplification Opportunities

Unificar Product grid/showcase como alias; feature variants en selector, conservar contenido; separar common/advanced; eliminar dependencia artificial NFC del copy comercio; una rutina de inventario; una fuente CMS nueva con legacy sólo compatibilidad. No reset de contenido.

## 60. Comparison With Mature Platforms

Referencias seleccionadas por problemas reales, no por paridad: Shopify disponibilidad/reservas; WooCommerce atributos→variación; Payload bloques tipados/previews; Webflow separación datos/elementos. Comparación detallada y enlaces abajo. No propuesta de migrar framework.

## 61. Production Risks

Bloquean certificación: reservas sin expiry, stock/cancel carreras, releases, refunds, privacy fotos/reset, jobs producción sin avances, tests integración pendientes. AusPost/Etsy son bloqueantes si se promete automatización total; un lanzamiento manual limitado podría ser decisión explícita del negocio. No hay autorización automática para arreglarlos.

## 62. Functional Matrix

71 módulos clasificados en FUNCTIONAL_MATRIX. COMPLETE describe código en alcance limitado; UNKNOWN reservado a configuración/datos/hardware no accesibles.

## 63. Recommendation Backlog

30 IDs REC-001..030 permanentes, todos PROPOSED. No reutilizar IDs ni borrar findings invalidados; corregir con razón. No ranking por cantidad de features: integridad y operación primero.

## 64. Things We Should Not Build

Sin Shopify propio, CMS universal, multiwarehouse, universal card, microservicios/Kafka/Kubernetes, graph de dependencias, otros marketplaces, WMS, ZPL obligatorio o builder de CSS libre. Ver TECHNICAL_DEBT.

## 65. Current / Next / Later Architecture

CURRENT: monolito PostgreSQL, un origen, manual shipping si aprobado, operaciones transaccionales y contenido consistente. NEXT: outbox fiable, integración real carrier/Etsy, capabilities mínimas, segundo sitio. LATER: shared catalog/múltiples origins sólo si ventas lo exigen; extracción servicios únicamente con cuello de botella medido.

## 66. Suggested Roadmap

Fase1 integridad/seguridad: REC-001/002/005/009/011/014/020/025. Fase2 launch: REC-003/004/006/007/008/012/013/015/029/030. Fase3 eficiencia: Home/cards/mobile/styles/SEO/print. Fase4 crecimiento: segundo site y paginación/cursor. Fase5 opcional: retirar legacy tras medir. Aprobar recomendaciones primero; luego plan con dependencias/migrations/tests/rollout; STOP hasta aprobación del plan.

## Referencias oficiales y comparación aplicada

Consultadas 2026-09-22. Se distingue contrato público de permisos concretos de la cuenta del negocio, que no se verificaron.

| Referencia | Problema resuelto | ¿Lo tenemos? / actual | Gap | Momento / alternativa mínima |
|---|---|---|---|---|
| [Shopify inventory states](https://help.shopify.com/en/manual/products/inventory/fundamentals/inventory-states) | distinguir stock físico y comprometido/disponible | sí; inventory/reserved existen | caducidad y consistencia | NOW; mantener dos contadores y ledger, no copiar estados warehouse |
| [WooCommerce variable products](https://woocommerce.com/document/variable-product/) | atributos y combinaciones vendibles | sí; optionSelection y SKU | UI Style/Color/Size redundante | NEXT; atributos claros y combinaciones explícitas |
| [Payload blocks](https://payloadcms.com/docs/fields/blocks) | contenido tipado y selector comprensible | sí; 15 tipos con registry | previews/contratos duplicados | NEXT; thumbnails simples, sin nuevo CMS |
| [Webflow collection fields](https://help.webflow.com/hc/en-us/articles/33961390084499-Collection-fields) | separar datos del elemento visual | sí; controles dispersos | field groups y referencias | NEXT; agrupar campo+apariencia, no replicar canvas |

[Etsy third variation](https://developers.etsy.com/documentation/tutorials/third-variation/): confirma soporte de tres variaciones, custom IDs 513/514/516 y parámetro max_variations_supported=3. El código coincide en IDs y omite parámetro. REC-012: validar también lectura y escritura; no sólo permitir un tercer campo en Admin.

[Etsy fulfillment](https://developers.etsy.com/documentation/tutorials/fulfillment/): createReceiptShipment necesita transactions_w. El scope actual contiene transactions_r; no existe llamada de tracking en código. Eso es missing implementation, no limitación impuesta por Etsy.

[Australia Post developer portal](https://auspost.com.au/developers/) describe Shipping & Tracking para etiquetas/envíos/tracking. [Guía oficial eParcel Contract](https://auspost.com.au/content/dam/auspost_corp/media/documents/eparcel-contract-ecommerce-partner-integration-guide.pdf) distingue eParcel Contract de MPB y acceso por cuenta/credenciales. La [página de registro](https://developers.auspost.com.au/apis/st-registration) no devolvió contenido legible en esta consulta. Elegibilidad directa MPB y contrato de rates/void específicos quedan UNKNOWN; no equiparar credenciales MyPost de usuario con API Shipping & Tracking.

## Operaciones diarias — estimación desde código

Pantallas/clicks son aproximaciones de navegación y guardado, excluyen teclear, elegir archivos y autenticarse. **No son tiempos medidos con navegador.**

| Operación | Pantallas / clicks estimados | Fricción / dependencia | Clase |
|---|---|---|---|
| Crear/editar producto | 2 / 3–6 más variantes | formulario largo; error por unidad; duplicar ayuda | ADMIN OPERATION |
| Cambiar precio | 2 / 3–4 | variante y opciones/deltas; Etsy precio difiere | ADMIN OPERATION |
| Stock | 1–2 / 3–4 | dos caminos con distinta auditoría | ADMIN OPERATION |
| Imágenes producto/color | 2 / 4–6 | mapping variante/optionValue en panel separado | ADMIN OPERATION |
| Editar Home/Category | 2–3 / 4–7 | legacy/vacío, duplicación controles | ADMIN OPERATION |
| Capabilities | 2 / 3–4 | accounts/my products faltan | ADMIN OPERATION tras implementación |
| Recibir order | 1–2 / 2–3 | email fallo no visible | ADMIN OPERATION |
| Personalización/preparar | 2 / 3–5 | job sin avanzar, objeto Etsy ilegible | ADMIN OPERATION incompleta |
| Ready To Ship | 1 / 2–3 | no gate preparación | ADMIN OPERATION |
| Etiqueta real | no completa en Admin | requiere portal externo/adaptador | ADMIN OPERATION pendiente |
| Impresión | 1 / 1–2 con agente configurado | hardware/driver/lease | operación; instalación TECHNICAL CONFIGURATION |
| Tracking manual | 1 / 3–4 | reescribir carrier/number | ADMIN OPERATION |
| Refund | no disponible | Stripe/Etsy externo y reconciliación | ADMIN OPERATION pendiente |
| Etsy pedido | 1–2 / 2–4 si sync correcto | mapping/stock puede bloquear import | ADMIN OPERATION |
| NFC replacement | varias / no flujo completo | estado sin sucesor guiado | soporte manual por ahora |
| DNS/OAuth/secrets | fuera CMS | técnico poco frecuente | TECHNICAL CONFIGURATION |
| Migrations/backup/restore | scripts/CI | entorno aislado y ensayo | DEPLOYMENT CONFIGURATION |
| Corregir adapter/contrato | repo/tests | aprobación de plan | DEVELOPER TASK |

## Validación pendiente y salida de auditoría

No se ejecutaron PostgreSQL E2E, tests de concurrencia DB, navegador con datos, Docker build, restore, Stripe/Etsy/AusPost reales ni impresora. No se inspeccionó el contenido actual del Docker del usuario: no puedo confirmar categorías, stock, batches o contenido Pets guardados allí. No se instalaron dependencias para suplir el entorno.

El resultado es un informe de análisis de código y pruebas locales con estas limitaciones explícitas. Los pendientes de verificación no se convierten en funcionalidades aprobadas. Siguiente paso: revisión de REC IDs; si se pide continuar auditoría, proporcionar entorno de prueba aislado ya disponible para los casos indicados en AUDIT_PROGRESS. Ningún arreglo implementado, ningún commit/push/merge.

## SEO / AI SEARCH / MARKET DISCOVERABILITY

Ampliación 2026-09-22 · §§183–213 del adjunto · develop dc80810. Revisión estática y documentación primaria; no crawling del sitio desplegado, DB del usuario ni acceso a Search Console/Keyword Planner. Todas las recomendaciones PROPOSED.

### Current State

| Área | Ya existe | Falta o debe validarse |
|---|---|---|
| Site/Brand | Store, dominios, título/descripción, imagen social; Admin businessName; metadataBase por store.origin | Defaults consistentes, datos locales tipados y verificación por dominio |
| Page/Category/Product | Slug, SEO title/description, canonical override, indexable y OG; fallbacks en varias rutas | Fallback Page description y canonical de rutas estáticas; controles sin duplicación |
| Schema | Home Organization/WebSite; producto Product/Offer/BreadcrumbList; categoría CollectionPage/FAQPage | Coherencia precio/variante/disponibilidad; WebPage cuando aporte; política local |
| Crawl | Sitemap dinámico por Store, robots por entorno, render servidor | Pages/FAQ ausentes, rutas base no disponibles en otra tienda, imágenes /api/media |
| NFC | /t/<publicTagId> noindex y excluido sitemap | Conflicto con disallow; noindex nunca sustituye controles de acceso |
| Servicios | Page modular, texto, FAQ, CTA, menú opcional | Plantilla editorial y enlaces; no hace falta nuevo CMS ni entidad Service obligatoria |

Evidencia: app/layout.tsx, app/page.tsx, app/sitemap.ts, app/robots.ts, app/faq/page.tsx, app/guides/page.tsx, app/products/[slug]/page.tsx, app/[categorySlug]/page.tsx, app/t/[publicTagId]/page.tsx, prisma/schema.prisma, components/store-settings-form.tsx, lib/landing-sections.ts. El código revisado ya permite nombres sin prefijos NFC/3D. La presentación comercial aún depende de capacidades de tienda en algunos puntos (REC-008); no confundir eso con una restricción del nombre.

### Technical SEO

Priorizar REC-024 y REC-031..034: sitemap completo, canonical correcto, redirecciones por cambio de slug y oferta fiel al checkout. La oferta actual puede combinar precio de una variante y stock de otra; una opción obligatoria con precio adicional exige comprobar el total. Backorder no equivale automáticamente a existencia física. No inventar GTIN, ratings, dirección o plazos.

Revisar páginas de filtros y paginación: qué aporta contenido independiente, cuál consolida a la ruta principal y cuál queda noindex. Probar respuestas reales y enlaces HTML; no canonizar todas las páginas paginadas a la primera por defecto. Medir rendimiento móvil en staging (LCP/CLS/INP cuando haya datos adecuados); no afirmar Core Web Vitals aprobados sin medición.

### AI Search Readiness

| Clasificación | Decisión |
|---|---|
| CONFIRMED REQUIREMENT | Google requiere indexación y elegibilidad de snippet para sus funciones generativas; comprobar configuración aplicable en Search Console. No garantiza aparición. [Google](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| CONFIRMED REQUIREMENT | Para aparecer como resultado de búsqueda de ChatGPT, permitir OAI-SearchBot y comprobar WAF/IP. GPTBot tiene finalidad distinta y su permiso se decide aparte. [OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| RECOMMENDED SEO PRACTICE | Contenido útil visible, enlaces, metadata y oferta coherentes; medios accesibles y sitio usable. Reutilizar SEO existente. [Google](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| EXPERIMENTAL / UNCERTAIN | Puntuaciones GEO, supuestas fórmulas de citación o garantía de menciones. No implementarlas como requisito. Google declara que no usa llms.txt para ranking/visibilidad. [Google](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |

La URL de directrices Bing devolvió sólo una página sin contenido utilizable en esta consulta; no se atribuyen a Bing requisitos no verificados. Validar alta/crawl en Webmaster Tools al disponer del sitio. IndexNow confirma recepción de cambios, no indexación ni citación en Copilot. [IndexNow](https://www.indexnow.org/documentation.html)

### Local SEO

Describir Adelaide/South Australia sólo para servicios realmente prestados. Organization es el default; LocalBusiness depende de la actividad y datos pertinentes, no sólo de vivir en Adelaide. No publicar el domicilio del usuario ni reutilizar automáticamente shipping origin como dirección comercial pública. Business Profile requiere elegibilidad, y negocios exclusivamente online no califican según la política consultada. [Google Business Profile](https://support.google.com/business/answer/13763036?hl=en)

### Product Search Strategy

Nombre comercial → problema/uso → beneficio → características → fabricación. Ejemplo editorial, no cambio aprobado: “Personalised pet tag” con NFC/QR explicado como característica. Mantener personalisation NONE/OPTIONAL/REQUIRED, color/tamaño/forma, imágenes y snapshots. No convertir todo a personalizado ni a NFC. El nombre final lo decide el propietario, no una regla de keywords.

### Market Demand Insights

No se han obtenido volúmenes verificables de Australia ni una comparación de ventas Etsy. “Headphone stand” frente a “3D printed headphone stand”, y mayor demanda de personalizados, son hipótesis a contrastar. Ninguna estimación de ventas o rentabilidad se deduce de este documento.

Investigación externa propuesta: comparar familias pet tags, regalos personalizados, accesorios de escritorio, servicios 3D locales y productos NFC. Registrar consulta, intención (informacional/comercial/transaccional/local), fuente, Australia/Adelaide, período, fecha de extracción, motor, unidad, exacto/estimado/relativo, competencia, precio y costes. Datos ausentes = ND. Google Trends es una señal relativa, no un volumen absoluto; no sumar Google/Etsy como el mismo mercado. Priorizar intención comercial, transaccional y local sin descartar preguntas útiles de soporte. Antes de una línea nueva, documentar material/tiempo/fallos/packaging/envío/comisiones y margen esperado con hipótesis visibles.

### Content Opportunities

- Pets: qué hace el tag, compatibilidad real, activación, ausencia de GPS, personalización, materiales, cuidados, envío y devoluciones.
- Servicio 3D (sólo cuando esté disponible): materiales ofrecidos, archivos aceptados, proceso de presupuesto, plazos reales, área de servicio, ejemplos propios y CTA de contacto existente. Un formulario seguro para subir STL sería otro alcance, no implícito en una página informativa.
- Guías breves y FAQs compartidas con enlaces al producto/categoría adecuado. No duplicar pregunta administrada en tres lugares: reutilizar la fuente existente cuando corresponda.

Checklist editorial por oferta: quién, qué, dónde, precio o cómo se cotiza, funcionamiento, beneficio, entrega, personalización, compatibilidad, devoluciones y seguridad. No prometer resistencia al agua, seguridad infantil, precisión GPS o materiales certificados sin evidencia. El texto actual guardado de Pets no fue accesible, por lo que esta revisión de contenido queda pendiente sobre export/DB autorizada.

### Things Not To Build

No keyword research dentro del CMS, dashboard SEO enterprise, editor JSON-LD, páginas masivas por suburbio, reseñas inventadas, duplicados por keyword, blog obligatorio, puntuación “AI-ready” ni promesa de citas. No cambiar URLs NFC para hacerlas SEO.

Las FAQs visibles siguen siendo útiles. La documentación actual informa que Google dejó de mostrar FAQ rich results; no añadir FAQPage con esa promesa ni confundir marcado schema válido con un resultado enriquecido disponible. [Actualizaciones de Google](https://developers.google.com/search/updates)

Robots disallow puede impedir que Google lea noindex; acordar una política para perfiles públicos sin hacer accesibles los privados. [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

### Recommendations

Backlog general: REC-024 ampliada y REC-031..037. Dependencias: REC-008 capabilities, REC-009 privacidad, REC-011 promoción, REC-019 catálogo y REC-025 QA. No crear backlog SEO separado.

### Suggested Priority

- NOW: validar hipótesis comerciales antes de ampliar catálogo (REC-036), preservar contenido y establecer alcance por Site.
- BEFORE LAUNCH: REC-024/031/032/033/034 y metadata de servicios/productos efectivamente ofrecidos; alta externa básica REC-037.
- AFTER LAUNCH: consultas, impresiones, clicks, CTR, posición, landing y conversiones; revisar referidos IA donde sean identificables, sin asumir atribución completa.
- WHEN NEEDED: servicios nuevos legítimos, idiomas completos, IndexNow opcional.
- PROBABLY NOT NEEDED: dashboard propio, automatización masiva de contenido y métricas GEO especulativas.

Fuentes consultadas 2026-09-22; reglas externas deben revalidarse al implementar. Las pruebas existentes no cubren esta ampliación SEO; no se ejecutaron tests ni se cambió la aplicación en esta revisión documental.
