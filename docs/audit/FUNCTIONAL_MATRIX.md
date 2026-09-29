# Matriz funcional

COMPLETE = implementación identificada en alcance indicado, no certificación de producción. PARTIAL = parte operativa y gap; MISSING = sin implementación requerida; PROBLEMATIC = defecto; UNKNOWN = no verificable.

| Módulo | Estado | Evidencia / alcance |
|---|---|---|
| Platform Core | PARTIAL | Monolito funcional; cerrar integridad y operaciones antes de lanzamiento. |
| Sites | PARTIAL | Store/Domain/Membership; onboarding técnico. |
| Brands | PARTIAL | Store identidad y Product.brand; no catálogo compartido. |
| Site Capabilities | PROBLEMATIC | REC-008; cuentas/My Products no independientes. |
| CMS | PARTIAL | Persistencia tipada; legacy/fallback y fallos silenciosos. |
| Home | PROBLEMATIC | REC-010; vacío revive fallback. |
| Sections | PARTIAL | 15 tipos; CRUD/reorder/duplicado disponibles. |
| Cards | PARTIAL | Duplicación y taxonomía en documento específico. |
| Header | PARTIAL | Navegación/theme/typography; account fijo con commerce. |
| Footer | PARTIAL | Texto/links/social imagen; preview responsive pendiente. |
| Navigation | PARTIAL | Header/footer/custom pages; posible duplicación FAQ/custom link. |
| Themes | COMPLETE | Cinco familias pastel, herencia y overrides presentes; validación visual pendiente. |
| Typography | PARTIAL | Inter, pesos e italic, px; controles perfil no coherentes. |
| Media | PROBLEMATIC | Uploads/referencias; privacidad/caches/orphans REC-009/021. |
| Pages | PARTIAL | Tipos y placement; import y sitemap incompletos. |
| FAQs | PARTIAL | Agrega generales/categorías; doble fuente legacy/modular y fallback. |
| SEO | PARTIAL | Metadata/JSON-LD/robots; sitemap sin ContentPage. |
| Localization | PARTIAL | CMS traducible, journeys en inglés. |
| Categories | PARTIAL | CRUD/política delete; coexistencia legacy/modular. |
| Products | PARTIAL | CRUD, estados, imágenes, opciones; stock bypass/visibilidad. |
| Variants | PARTIAL | Colour/size/style mediante options; redundancia con selector Style. |
| Personalization | PARTIAL | Modos separados, snapshot texto; IMAGE placeholder. |
| Inventory | PROBLEMATIC | CHECK protege límites; carreras, reservas y channel sync pendientes. |
| Cart | PARTIAL | Local por store; precios visuales pueden envejecer, servidor recalcula. |
| Checkout | PARTIAL | Quote/token/stock/payment; expiración no completa. |
| Guest Checkout | COMPLETE | Contrato implementado y pruebas básicas; E2E DB no ejecutado aquí. |
| Customer Accounts | PARTIAL | Auth/direcciones/claim; falta capability independiente. |
| My Orders | PARTIAL | Historial y recibos; sin refund self-service. |
| My Products | PARTIAL | Gestión tags; configuración por sitio y móvil pendientes. |
| Customers | PARTIAL | Listado/status; status global, max200 sin paginación. |
| Orders | PARTIAL | Snapshots e historial; falta operaciones refund/excepciones. |
| Payments | PARTIAL | Stripe signature/matching/idempotencia; eventos limitados. |
| Refunds | MISSING | Enum no implementa devolución ni restock. |
| Shipping | PARTIAL | Tarifa/quote local, manual tracking; falta carrier real. |
| Shipping Origins | PARTIAL | Modelo/listado, no edición Admin. |
| Shipping Rates | PARTIAL | Tarifas configuradas y fallback, no CRUD. |
| Packaging | PARTIAL | Modelo/selección/packing aproximado; Admin read-only. |
| Australia Post | MISSING | Adapter quote explícitamente no implementado. |
| MyPost Business | MISSING | Cuenta/acceso no verificados; sin integración. |
| Shipping Labels | PARTIAL | PDF MOCK, no franqueo real. |
| Label Printing | PARTIAL | Agent/lease/spooler, no hardware probado. |
| Tracking | PARTIAL | Manual order/shipment; sin polling carrier. |
| Fulfilment | PARTIAL | Ready To Ship y estados; no validación de tareas. |
| Notifications | PROBLEMATIC | Emails enviados sin outbox/retry persistente. |
| Sales Channels | PARTIAL | MarketplaceOrder/Connection y sourceDomain; no manual order UI. |
| Etsy Connection | PARTIAL | OAuth PKCE/tokens cifrados; cuenta real UNKNOWN. |
| Etsy Products | PROBLEMATIC | Draft/images/inventory; parámetro tercera variación omitido. |
| Etsy Inventory | PROBLEMATIC | Outbox con carrera; precio base/estado discrepante. |
| Etsy Orders | PROBLEMATIC | Receipt idempotente; excepciones bloquean lote. |
| Etsy Tracking | MISSING | No createReceiptShipment, falta scope. |
| NFC Tags | PARTIAL | Identity/owner/estados sólidos; replacing no vínculo sucesor. |
| Manufacturing | PARTIAL | Jobs auto creados, lectura; avances sólo para tags. |
| Batches | PARTIAL | Generación/estados; no hardware probado. |
| Activation | COMPLETE | Hash/código, rate limit, claim atómico; prueba integrada pendiente. |
| Profiles | PARTIAL | Datos tipados, pet foto/card; privacidad media. |
| Lost Mode | COMPLETE | Owner toggle y audit; visual real pendiente. |
| Replacement | PARTIAL | Estado REPLACED sin flujo sucesor/transferencia. |
| QR | COMPLETE | Generación misma URL y truncado/copy; visual pendiente. |
| Authentication | PARTIAL | Password/OAuth/session; recuperación REC-020. |
| Authorization | PARTIAL | Scope Store/owner, platform admin; matriz runtime pendiente. |
| Google Auth | UNKNOWN | Código OIDC presente; credenciales/journey real no probado. |
| Apple Auth | UNKNOWN | Form POST/nonce/PKCE presentes; proveedor real no probado. |
| Admin | PARTIAL | Módulos operativos, controles read-only y mensajes ambiguos. |
| Audit Logs | PARTIAL | Acciones persistidas; retención y operaciones faltantes. |
| Security | PARTIAL | Defensas verificadas estáticamente, no certificación. |
| Analytics | PARTIAL | Scans agregados, no funnel comercio necesario ahora. |
| Backups | UNKNOWN | Scripts presentes; restore no ejecutado. |
| Monitoring | PARTIAL | Logs/readiness/liveness; alertas/colas no demostradas. |
| Content Releases | PROBLEMATIC | REC-011; round-trip y aislamiento datos operativos. |
| Seed / reset | PROBLEMATIC | Sobrescribe datos gestionados; guard producción insuficiente. |
| Current catalog data | UNKNOWN | No DATABASE_URL; no afirmar Pets único ni stock0 real. |

Evidencia detallada: AUDIT_FINDINGS/AUDIT_BACKLOG, CARD_SYSTEM_AUDIT, SITE_CAPABILITIES_AUDIT. Baseline tests 151/30 PASS, lint/typecheck/build PASS.
