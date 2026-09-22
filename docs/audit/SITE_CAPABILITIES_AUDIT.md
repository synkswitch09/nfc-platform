# Capabilities por Site / Store

La arquitectura actual resuelve Store por host/entorno y limita sesiones y operaciones al Store. No necesita SaaS ni microservicios. Brand está representada por identidad de Store y texto en Product; no hay catálogo compartido multi-store. Identidad User y direcciones son globales, Session y memberships son por tienda. Hay que decidir explícitamente si compartir direcciones/suspensión de cuenta es deseado; suspensión de customer actual es global y sólo platform ADMIN puede aplicarla.

| Capability | Implementación / scope actual | Global / sitio / producto | Dependencias | Admin configurable | Routes / APIs afectadas | Seguridad / recomendación |
|---|---|---|---|---|---|---|
| Commerce | StoreCapability.COMMERCE y ACTIVE | sitio | pagos/envíos | sí settings | /shop, /products, /checkout, /api/checkout | Mantener guard servidor; revisar consistencia de rutas de lectura |
| Cart | localStorage con key por store | sitio | commerce | no flag propio | /cart, CartProvider | no confiar precio cliente; servidor ya recalcula |
| Checkout | checkout guest o user | sitio | commerce, quote, stock, Stripe | parcial | /checkout; /api/checkout | completar expiración/reconciliación REC-001 |
| Customer Accounts | siempre disponibles | identidad global; sesión sitio | auth | no independiente | /login, /register, /dashboard, /api/auth/* | REC-008: UI y rutas; separar de NFC |
| Guest Checkout | implementado, userId opcional | sitio | contacto/envío | no flag | checkout, /order/*/success, /api/orders/claim | conservar token hash, expiración, verificación email |
| My Orders | órdenes por owner/store | sitio | account | no flag | /dashboard/orders/* | mantener scoping, independiente de My Products |
| My Products | dashboard de tags | sitio/owner | account+tags | no flag | /dashboard, /dashboard/tags/* | no mostrar en commerce-only; continuidad de tags existentes |
| NFC | enum, guards activation/batches | sitio; inferencia por ProductType | DIGITAL_PROFILE requerido en settings | sí sitio | /activate, /api/tags/activate, /admin/tags/* | capability explícita producto REC-008; no apagar tags vendidos al archivar catálogo |
| Activation | sólo NFC | sitio/tag | login, UNCLAIMED y código | indirecto | /activate, /api/tags/activate | claim atómico correcto; sin motor genérico de dependencias |
| Digital Profiles | modelos tipados, perfil público | tag+store | ownership/estado/isPublic | texto/color PET, perfil owner | /t/*, /api/tags/*/profile | coherencia media REC-009 |
| Lost Mode | ACTIVE↔LOST, owner, historial | tag | perfil gestionado | owner control; admin status | /dashboard/tags/*, /api/tags/*/status | preservar privacidad y bloquear no-owner |
| QR | mismo public URL que NFC | tag | identidad | generación automática | /t/*, TagQrCard, batch | QR estático copiable; no promete anti-clonación |
| Personalization | NONE/OPTIONAL/REQUIRED y BASIC/PERSONALISED | producto; enum sitio también existe | options | sí producto | ProductPurchase, checkout, OrderItem | texto/elecciones operables; IMAGE es TO_BE_CONFIRMED |
| Inventory | inventory/reserved + movimientos | variante; enum sitio | stock tracking | sí | admin inventory/product, checkout, Etsy | política común REC-002, no WMS |
| Print 3D | jobs automáticos por capability tienda | sitio / job | paid order | sólo flag/lectura queue | /admin/manufacturing | falta operación job REC-030 |
| Search | filtros/query Shop/Admin | tienda | catálogo | no motor configurable | /shop, /admin/products | mantener búsqueda simple; no motor externo |
| Localization | locales y traducciones páginas/secciones | sitio; copy parcial global | contenido traducido | parcial | locale query/cookie, translations APIs | anunciar sólo idiomas completos; REC-024 |
| PET / CHILD / BUSINESS / SOCIAL profiles | enums y modelos especializados | sitio/tag type | NFC/profile | partial | renderer y ProfileEditor | no crear otros tipos por industria sin caso real |

## Modelo mínimo propuesto, no implementado
NOW: mantener commerce/guest checkout; separar accounts y managedProducts; tipo/capability de producto para decidir NFC y preparación. Dependencias locales con mensajes: managedProducts requiere accounts; deshabilitar venta NFC no destruye atención a tags existentes. PREPARE FOR: configuración de integraciones por Store, onboarding de segundo dominio y navegación sin NFC. LATER: compartir catálogo si ambas marcas lo necesitan realmente. NOT NEEDED: SiteType fijo, RBAC engine, feature graph o billing SaaS.

Rutas públicas de perfil intencionalmente no consultan estado comercial de Product/Category. No confundir esa continuidad con un fallo de feature guard. Política para deshabilitar NFC en tienda con tags vivos debe acordarse antes de modificarla.

Evidencia: prisma/schema.prisma; lib/storefront.ts; lib/admin.ts; lib/auth.ts; app/api/admin/settings/route.ts; components/site-header.tsx; app/products/[slug]/page.tsx; lib/manufacturing.ts; app/api/tags/activate/route.ts. Estado runtime y datos de cada Store: UNKNOWN en este entorno.
