# Backlog de auditoría

2026-09-22 · HEAD dc80810 · Todos los estados PROPOSED. IDs permanentes. P1 no es autorización. Esfuerzo S≈1–2 días, M≈3–5 días, L≈1–2 semanas orientativos, sin compromiso; incluyen pruebas y dependen del acceso externo.

## REC-001 — Checkout / reservas
- AREA: Checkout / reservas
- TYPE: DATA INTEGRITY
- PROBLEM / CURRENT BEHAVIOUR: Checkout abandonado conserva reserva indefinidamente: webhook sólo procesa completed.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/order-service.ts:createPendingOrder/cancelPendingOrder; app/api/stripe/webhook/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Procesar expiración/fallo aplicable y reconciliar pedidos pendientes con Stripe; liberación atómica idempotente. No liberar sólo por volver al cancel_url.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en checkout / reservas y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Reconciliación programada sencilla más revisión de pendientes; sin motor de eventos.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-002 — Inventario
- AREA: Inventario
- TYPE: DATA INTEGRITY
- PROBLEM / CURRENT BEHAVIOUR: Doble cancelación puede liberar reservas ajenas; ajustes absolutos y edición de producto carecen de versión y ledger uniforme. CHECK SQL evita negativos, pero no pérdidas de actualización válidas.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/order-service.ts:cancelPendingOrder; app/api/admin/inventory/route.ts; app/api/admin/products/[productId]/route.ts; migration 20260908150000`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Una operación transaccional de ajuste/reserva/liberación con compare-and-set, motivo y movimiento; editor de producto debe usarla. Probar carreras en PostgreSQL.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en inventario y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Bloquear cambios de stock en formulario general y usar ajuste dedicado mientras se completa.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-003 — Pagos / devoluciones
- AREA: Pagos / devoluciones
- TYPE: MISSING FUNCTIONALITY
- PROBLEM / CURRENT BEHAVIOUR: REFUNDED existe en enum pero no hay transición ni devolución Stripe; pedido pagado no puede cancelarse.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/order-status.ts; app/api/admin/orders/[orderId]/status/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Reembolso total idempotente con estado de pago, sincronización webhook y decisión explícita de reponer stock; parcial cuando haga falta.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en pagos / devoluciones y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Stripe Dashboard y conciliación manual documentada y visible como operación externa.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-004 — Transportista real
- AREA: Transportista real
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: AusPost lanza error; createShipmentLabel rechaza todo excepto MOCK. Etiqueta MOCK no compra franqueo.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/shipping-providers.ts; lib/fulfilment-service.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Confirmar acceso MPB/eParcel y construir sólo adaptador permitido, con referencias persistidas antes de reintentar; fallback de tracking manual.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en transportista real y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: L
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Tarifa configurada y etiqueta comprada en portal del transportista; lanzar así sólo si se acepta explícitamente.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-005 — Etsy cola
- AREA: Etsy cola
- TYPE: DATA INTEGRITY
- PROBLEM / CURRENT BEHAVIOUR: Upsert reabre trabajo PROCESSING y finalización lo cierra sin versión; caída deja PROCESSING permanente.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:queueEtsyInventorySync/processEtsySyncJobs`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Lease de worker, versión o dirty flag y finalización condicional; timeout y retry de red; reconciliación simple.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en etsy cola y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Un único worker y reconciliación periódica reduce riesgo, no resuelve por sí solo actualización perdida.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-006 — Etsy pedidos pagados
- AREA: Etsy pedidos pagados
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: Un receipt con SKU no vinculado/stock insuficiente aborta todo el lote y no aparece como pedido operable.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:importEtsyReceipt/executeEtsyReceiptsJob`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Registrar recepción idempotente y excepción visible por receipt, continuar otros; resolver mapping/stock sin perder venta.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en etsy pedidos pagados y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Bandeja de receipts pendientes antes de convertir a Order.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-007 — Etsy personalización y fulfilment
- AREA: Etsy personalización y fulfilment
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: Se infiere PERSONALised de variations; no configuración de personalización en listing ni sincronización saliente tracking/refunds/cancelaciones.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:configureEtsyDraftListing/importEtsyReceipt; ETSY_SCOPES sin transactions_w`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Separar variaciones de datos personalizados; mapear campos soportados; crearReceiptShipment con permiso correcto; reconciliar cambios remotos.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en etsy personalización y fulfilment y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: L
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Completar estas operaciones en Etsy mientras Admin las marca claramente como externas.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-008 — Capabilities por tienda/producto
- AREA: Capabilities por tienda/producto
- TYPE: ARCHITECTURE
- PROBLEM / CURRENT BEHAVIOUR: Account depende de commerce en Header; no flags account/my products. Manufacturing depende de PRINT_3D de tienda y tipo != ACCESSORY; producto normal en tienda NFC recibe mensajes NFC.
- EVIDENCE / AFFECTED FILES / MODULES: `prisma/schema.prisma:StoreCapability/Product; components/site-header.tsx; lib/manufacturing.ts; app/products/[slug]/page.tsx`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Flags mínimos cuentas/managed products y capability explícita por producto, con validación de dependencias y guards; preservar perfiles vendidos.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en capabilities por tienda/producto y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Mantener ACCESSORY como compatibilidad durante transición; no crear tipos rígidos de Site.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-009 — Privacidad de fotos
- AREA: Privacidad de fotos
- TYPE: SECURITY
- PROBLEM / CURRENT BEHAVIOUR: Media de mascota sólo verifica pertenencia al store; no isPublic/status/owner. Cache público immutable un año continúa accesible por URL conocida tras ocultar perfil.
- EVIDENCE / AFFECTED FILES / MODULES: `app/api/media/[storageKey]/route.ts; lib/uploads.ts; lib/catalog-policy.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Política diferenciada para media privada/perfil: autorizar owner o perfil público activo, cache compatible con revocación y limpieza de metadatos.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en privacidad de fotos y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: directo; cerrar la exposición o consumo de credencial descritos.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Ruta separada para fotos de perfil, conservar cache largo sólo para catálogo público.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-010 — Home / persistencia CMS
- AREA: Home / persistencia CMS
- TYPE: BUG
- PROBLEM / CURRENT BEHAVIOUR: Admin GET crea y publica Home vacía; Home pública sin secciones visibles vuelve a contenido legacy. Borrar/ocultar no equivale a vacío.
- EVIDENCE / AFFECTED FILES / MODULES: `app/admin/storefront/home/page.tsx; app/page.tsx`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Distinguir no migrado de vacío intencional; bootstrap explícito y render vacío consistente; evitar escritura al consultar.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en home / persistencia cms y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Marca de migración una vez, manteniendo contenido actual.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-011 — Promoción contenido
- AREA: Promoción contenido
- TYPE: DATA INTEGRITY
- PROBLEM / CURRENT BEHAVIOUR: Export incluye inventory/reservedInventory; import los sobrescribe. cleanSection siempre agrega translations, syncPage lo pasa a createMany sin quitarlo. Schema passthrough admite campos no aprobados y cast no valida.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/storefront-release.ts:cleanProduct/cleanSection/syncPage/importStorefrontRelease; tests/storefront-release.test.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Contrato allowlist de contenido, excluir datos operativos; persistir traducciones por sección; round-trip con DB; preview real y conflictos. Revisar campos anidados para aislamiento.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en promoción contenido y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Export/import sólo CMS hasta verificar catálogo; stock siempre gestionado en destino.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-012 — Contrato Etsy tercera variante
- AREA: Contrato Etsy tercera variante
- TYPE: BUG
- PROBLEM / CURRENT BEHAVIOUR: Permite tres custom properties 513/514/516 pero GET/PUT inventory omite max_variations_supported=3.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:configureEtsyDraftListing/verifyEtsyListing/executeEtsyInventoryJob/etsyRequest; documentación oficial tercera variación`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Añadir negociación requerida y validar payload de escritura contra contrato, con fixture real y prueba de API controlada.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en contrato etsy tercera variante y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Limitar publicación a dos variantes hasta validar tercera; no negar que API soporta tres.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-013 — Shipping Admin diario
- AREA: Shipping Admin diario
- TYPE: MISSING FUNCTIONALITY
- PROBLEM / CURRENT BEHAVIOUR: Origin, Packaging y Rates se muestran pero no tienen CRUD; zonas sólo edición de existentes. Falta confirmación peso/paquete/servicio al generar etiqueta.
- EVIDENCE / AFFECTED FILES / MODULES: `app/admin/shipping/page.tsx; app/api/admin/shipping; app/api/admin/orders/[orderId]/shipment/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: CRUD mínimo origen único, paquetes, tarifas y zonas; confirmar medidas reales y servicio por envío sin alterar cotización histórica.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en shipping admin diario y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Origen único con dos embalajes y tarifa plana; no optimizador logístico.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-014 — Seed / reset
- AREA: Seed / reset
- TYPE: DATA INTEGRITY
- PROBLEM / CURRENT BEHAVIOUR: Seed vuelve a publicar entidades y pone inventario/reservas del SKU base en cero; no es preservador de configuración. Start fresh no está limitado por entorno en endpoint.
- EVIDENCE / AFFECTED FILES / MODULES: `prisma/seed.ts:main; lib/store-reset.ts; app/api/admin/store-reset/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Separar bootstrap no destructivo de demo/reset; bloquear reset en producción por defecto, mantener confirmación reforzada y backup.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en seed / reset y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: No ejecutar seed sobre datos administrados; migraciones separadas y release validada.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-015 — Notificaciones
- AREA: Notificaciones
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: Pago se confirma antes del email; allSettled descarta fallos y eventos duplicados no reenvían. Envíos catch silencioso.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/order-notifications.ts; lib/order-service.ts:settleCheckoutEvent; app/api/admin/orders/[orderId]/status/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Outbox pequeño de notificaciones, idempotency key y reintento visible; estado de entrega y último error.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en notificaciones y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Registro persistente y acción reenviar; sin plataforma de marketing.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-016 — Cards / secciones
- AREA: Cards / secciones
- TYPE: SIMPLIFICATION
- PROBLEM / CURRENT BEHAVIOUR: PRODUCT_SHOWCASE y PRODUCT_GRID ejecutan mismo markup y clases; múltiples tipos informativos usan mismo contrato con diferencias sólo visuales.
- EVIDENCE / AFFECTED FILES / MODULES: `components/landing-section-renderer.tsx; lib/landing-sections.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Un selector semántico con previews y variantes claras. Aliases compatibles; no borrar diseños actuales ni universal card. Ver CARD_SYSTEM_AUDIT.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en cards / secciones y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Agrupar nombres y explicaciones conservando formatos guardados.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-017 — Responsive owner dashboard
- AREA: Responsive owner dashboard
- TYPE: UX
- PROBLEM / CURRENT BEHAVIOUR: Detalle tag fija dos columnas inline de minmax(0,1.4fr) y mínimo260px; formulario queda comprimido en móvil aunque URL QR ya trunca.
- EVIDENCE / AFFECTED FILES / MODULES: `app/dashboard/tags/[tagId]/page.tsx; components/tag-qr-card.tsx; app/globals.css`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Apilar en móvil con breakpoint y probar 320/375/768/1440px, foto, nombre y URL largos.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en responsive owner dashboard y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Una columna para panel owner completo.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-018 — CMS perfil / validación
- AREA: CMS perfil / validación
- TYPE: BUG
- PROBLEM / CURRENT BEHAVIOUR: lostBackgroundColour se aplica a pet-urgent-card, no aviso LOST; clamp impone mínimo32px aunque permite nameSize24px. Errores numéricos de producto dicen characters.
- EVIDENCE / AFFECTED FILES / MODULES: `app/globals.css:pet-urgent-card/pet-profile-identity; lib/pet-profile-cms.ts; lib/product-validation-feedback.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Vincular controles al elemento correcto y unidad correcta, prueba guardar-refrescar-render; conservar herencia simple.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en cms perfil / validación y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Quitar sólo controles que no pueden respetarse y explicar rango responsive.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-019 — Visibilidad catálogo
- AREA: Visibilidad catálogo
- TYPE: BUG
- PROBLEM / CURRENT BEHAVIOUR: Home consulta productos activos sin filtrar categoría; producto/detail/checkout sí exigen categoría publicada aunque categoryId admite null. Puede haber card que conduce a 404.
- EVIDENCE / AFFECTED FILES / MODULES: `app/page.tsx; app/products/[slug]/page.tsx; lib/order-service.ts; prisma/schema.prisma:Product`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Política compartida de visibilidad/venta y decisión explícita si categoría es obligatoria; Admin debe explicar requisito.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en visibilidad catálogo y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Exigir categoría publicada al publicar y aplicar mismo filtro a Home.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-020 — Recuperación de cuenta compartida
- AREA: Recuperación de cuenta compartida
- TYPE: SECURITY
- PROBLEM / CURRENT BEHAVIOUR: Password reset modifica contraseña global pero revoca sesiones sólo del store actual; usedAt se valida antes de transacción sin consumo condicional.
- EVIDENCE / AFFECTED FILES / MODULES: `app/api/auth/reset-password/route.ts; prisma/schema.prisma:User/Session`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Consumir token atómicamente, revocar todas sesiones del usuario si contraseña global cambia; probar uso concurrente.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en recuperación de cuenta compartida y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: directo; cerrar la exposición o consumo de credencial descritos.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Mantener identidad global, sin sistema SSO adicional.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-021 — Retención y uploads
- AREA: Retención y uploads
- TYPE: SECURITY
- PROBLEM / CURRENT BEHAVIOUR: Foto conserva bytes originales y posibles EXIF; múltiples borrados storage silenciosos; eventos/quotes/receipts acumulan PII sin política de retención.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/uploads.ts; app/api/tags/[tagId]/profile/photo/route.ts; lib/etsy.ts:MarketplaceOrder.externalData; lib/rate-limit.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Minimizar metadatos, límites de subida, tarea de limpieza con log y política de retención/export/borrado; revisión legal separada.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en retención y uploads y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: directo; cerrar la exposición o consumo de credencial descritos.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: No guardar payload remoto completo indefinidamente; limpieza programada sencilla.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-022 — Impresión
- AREA: Impresión
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: Lease 2min puede expirar durante impresión; comando termina pero respuesta complete no se comprueba: reimpresión automática potencial. No prueba física.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/fulfilment-service.ts; scripts/print-agent.mjs`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Timeout y renovación/check de ack; estado impresión incierta y reintento explícito; documentar entrega al spooler, no certeza física.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en impresión y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: PDF y diálogo del navegador primero; agente opt-in.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-023 — Identidad CMS / fallos silenciosos
- AREA: Identidad CMS / fallos silenciosos
- TYPE: TECHNICAL DEBT
- PROBLEM / CURRENT BEHAVIOUR: Keys agregan índice aun con UUID; parse inválido retorna null y desaparece sección; duplicación ya genera UUID nuevos correctamente.
- EVIDENCE / AFFECTED FILES / MODULES: `components/landing-section-renderer.tsx:renderSectionKey/collectionKey; lib/landing-sections.ts:parseLandingContent/duplicateLandingSection`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Keys por identidad estable, warning admin/log con sección inválida y preservar datos recuperables; test reorder con estado UI.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en identidad cms / fallos silenciosos y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: S
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Mantener UUID persistido y error legible; no esquema genérico nuevo.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-024 — SEO y localización
- AREA: SEO y localización
- TYPE: MISSING FUNCTIONALITY
- PROBLEM / CURRENT BEHAVIOUR: Sitemap no consulta ContentPage, omite custom pages y FAQ. Traducción CMS existe pero producto/checkout/admin/perfil/email tienen inglés fijo.
- EVIDENCE / AFFECTED FILES / MODULES: `app/sitemap.ts; lib/i18n.ts; components/product-purchase.tsx; app/t/[publicTagId]/page.tsx`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Incluir páginas publicadas indexables; alcance lingüístico explícito y traducir journeys prioritarios, no falsa cobertura total.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en seo y localización y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Lanzar sólo en-AU hasta completar idiomas expuestos.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-025 — QA real
- AREA: QA real
- TYPE: TECHNICAL DEBT
- PROBLEM / CURRENT BEHAVIOUR: 151 unit tests pasan pero no prueban import real release, carreras inventario, headers API Etsy, fotos privadas ni responsive. E2E HTTP requiere DB y muta datos.
- EVIDENCE / AFFECTED FILES / MODULES: `tests/; scripts/e2e-http.mjs; .github/workflows/_validate.yml`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Suite de integración en DB desechable y navegador para journeys críticos, contrato externo capturado y QA física de impresión.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en qa real y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Priorizar checkout/stock/release/privacidad y tres resoluciones, no cobertura porcentual arbitraria.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-026 — Operación y despliegue
- AREA: Operación y despliegue
- TYPE: TECHNICAL DEBT
- PROBLEM / CURRENT BEHAVIOUR: Docker/CI/backup existen; no evidencia local de restore ni configuración real staging/prod. Compose es development. DB y media se respaldan secuencialmente con app escribiendo.
- EVIDENCE / AFFECTED FILES / MODULES: `Dockerfile; docker-compose.yml; .github/workflows/_deploy-azure.yml; scripts/backup.sh; scripts/restore.sh`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Ensayo restore aislado y backup consistente, alertas readiness/pagos/colas; validar job migración y smoke antes de tráfico.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en operación y despliegue y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Una instancia y PostgreSQL con backups externos; no Kubernetes.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-027 — Simplificación del modelo/UI
- AREA: Simplificación del modelo/UI
- TYPE: OVERENGINEERING
- PROBLEM / CURRENT BEHAVIOUR: Cart/CartItem DB coexisten con carrito localStorage; legacy category/Home conviven con páginas modulares; muchas opciones visuales por item.
- EVIDENCE / AFFECTED FILES / MODULES: `prisma/schema.prisma:Cart/CartItem/StoreSettings; components/cart-provider.tsx; components/landing-section-editor.tsx`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Inventariar usos y deprecar sólo redundancia confirmada; poner contenido primero y apariencia avanzada colapsada.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en simplificación del modelo/ui y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P3
- TIMING: WHEN NEEDED
- SIMPLER ALTERNATIVE: Conservar esquema legacy de sólo lectura y no crear nuevas opciones.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-028 — Cursor Etsy / escala razonable
- AREA: Cursor Etsy / escala razonable
- TYPE: BUG
- PROBLEM / CURRENT BEHAVIOUR: Lote >=1000 falla antes de avanzar cursor; retry vuelve al inicio. Cursor usa hora final y puede omitir actualizaciones durante polling prolongado.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:executeEtsyReceiptsJob`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Watermark al inicio y progreso por página con solapamiento e idempotencia; un receipt fallido no debe bloquear cursor global.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en cursor etsy / escala razonable y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; fricción o mantenimiento incremental.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P2
- TIMING: AFTER LAUNCH
- SIMPLER ALTERNATIVE: Lotes pequeños persistiendo avance; no cola distribuida.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-029 — Precio y publicación Etsy
- AREA: Precio y publicación Etsy
- TYPE: INTEGRATION
- PROBLEM / CURRENT BEHAVIOUR: Sync manda variant.priceCents, no deltas de opciones; producto HIDDEN/ARCHIVED no controla listing remoto. Oferta puede diferir del precio/estado local.
- EVIDENCE / AFFECTED FILES / MODULES: `lib/etsy.ts:buildEtsyDraftInventoryPayload/buildEtsyInventoryPayload/executeEtsyInventoryJob; lib/catalog.ts; app/api/admin/products/[productId]/status/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Definir precio por canal y estado de publicación explícitos; resolver precio final de combinación, no sumar dos veces personalización.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en precio y publicación etsy y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; acceso de cuenta y contrato API real.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Precio Etsy separado validado por SKU y acciones de publicación explícitas.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## REC-030 — Producción diaria
- AREA: Producción diaria
- TYPE: MISSING FUNCTIONALITY
- PROBLEM / CURRENT BEHAVIOUR: ManufacturingJob se crea/lista pero no hay ruta de avance de ese job; único endpoint manufacturing modifica NFCTag. READY_TO_SHIP sólo valida transición Order, no preparación.
- EVIDENCE / AFFECTED FILES / MODULES: `app/admin/manufacturing/page.tsx; app/api/admin/tags/[tagId]/manufacturing/route.ts; app/api/admin/orders/[orderId]/status/route.ts`
- EXISTING INTENT: operación segura, intuitiva y separada por Store, sin repetir trabajo correcto.
- REGRESSION: no acreditada mediante comparación temporal; defecto/gap del checkout auditado.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Operación mínima de preparación por línea, checklist opcional NFC y marcar listo; usar snapshots históricos en cola.
- WHY / BUSINESS BENEFIT: reducir fallos operativos en producción diaria y evitar trabajo manual oculto.
- USER BENEFIT: resultado consistente y errores accionables en este flujo.
- TECHNICAL BENEFIT: contrato verificable y una política compartida, preservando el monolito.
- SECURITY IMPACT: mantener autorización y scope; no se atribuye vulnerabilidad adicional sin evidencia.
- RISK IF NOT DONE: persiste el comportamiento descrito; no considerar el flujo listo para producción.
- EFFORT: M
- COMPLEXITY ADDED: acotada al módulo; preferir alternativa mínima indicada.
- DEPENDENCIES: REC-025 para verificar; datos/fixtures aislados y aprobación de plan.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: Para bajo volumen, checklist de pedido; no workflow de fábrica completo.
- STATUS: PROPOSED
- ACCEPTANCE: reproducir caso descrito, verificar comportamiento recomendado y regresión de scope por tienda.

## Referencias de contratos externos

REC-012: [Etsy third variation](https://developers.etsy.com/documentation/tutorials/third-variation/), consultado2026-09-22: tres properties soportadas, requiere max_variations_supported=3. REC-007: [Etsy fulfillment](https://developers.etsy.com/documentation/tutorials/fulfillment/), transactions_w y createReceiptShipment. REC-004: [Australia Post portal](https://auspost.com.au/developers/); acceso concreto MPB pendiente, no asumir contrato eParcel. Comparación CMS/inventory en FINAL_AUDIT.

# Ampliación 2026-09-22 — §§183–213
IDs previos preservados; se agregan REC-031..037 al mismo backlog. Ninguna recomendación está aprobada para implementar.

## REC-031 — SEO por sitio y defaults por entidad
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: Store y ContentPage ya tienen metadata; falta verificar una política uniforme de defaults, datos locales y canonical por ruta. FAQ sólo declara title mientras layout declara canonical raíz.
- EVIDENCE / AFFECTED FILES / MODULES: app/layout.tsx; app/faq/page.tsx; components/store-settings-form.tsx; prisma/schema.prisma
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Resolver SEO desde Store + entidad + locale; completar defaults y UI compacta. No duplicar campos existentes. Confirmar en HTML la herencia de canonical de FAQ/Shop antes de corregirla.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: S–M, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-011, REC-024; dominio real validado.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: Cada página pública tiene canonical propio, metadata de su marca y fallback correcto sin campos vacíos; prueba dos dominios, locales y overrides.

## REC-032 — Datos estructurados fieles a la oferta
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: Product/Offer y breadcrumbs existen. Offer mezcla precio mínimo, SKU de primera variante y disponibilidad de cualquier variante, y trata backorder permitido como InStock.
- EVIDENCE / AFFECTED FILES / MODULES: app/products/[slug]/page.tsx; app/page.tsx; app/[categorySlug]/page.tsx; lib/catalog.ts
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Generar datos de una oferta comprable coherente con precio final y disponibilidad real; evaluar ofertas por variante o agregadas según el contrato vigente. Reutilizar Organization/WebSite y añadir WebPage donde aporte. FAQPage no tiene ahora rich result Google; conservar preguntas visibles, sin prometer ese beneficio.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: M, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-002, REC-008, REC-019, REC-024; validación oficial schema/Product al implementar.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: Caso variante barata agotada/cara disponible, deltas obligatorios, backorder, stock cero y tienda sin NFC: JSON-LD y UI coinciden; sin ratings, GTIN ni ubicación inventados.

## REC-033 — URLs estables y redirecciones por tienda
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: Categorías cuentan con legacySlugs; no se encontró equivalente en Product/ContentPage en el esquema revisado. Cambios de slug requieren una política común; sitemap y canonical deben alinearse.
- EVIDENCE / AFFECTED FILES / MODULES: prisma/schema.prisma:ProductCategory.legacySlugs/Product/ContentPage; lib/category-query.ts; app/[categorySlug]/page.tsx
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Mantener slugs actuales; alias/redirect permanente sólo al renombrar, dentro de la misma tienda. Evitar rutas reservadas, colisiones página/categoría, ciclos, cadenas y open redirects. Definir canonical de filtros/paginación/locales sin indexar combinaciones vacías.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: M, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-031 y ampliación REC-024.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: URL antigua lleva a nueva en un salto, destino de misma tienda; colisiones bloqueadas con mensaje de campo; NFC URLs no cambian; sitemap sólo contiene destinos canónicos.

## REC-034 — Crawlers de búsqueda y privacidad NFC
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: Robots permite contenido público con wildcard, bloquea todo /api/ y /t/. Fotos comerciales servidas en /api/media requieren evaluar rastreo. /t/ declara noindex pero su disallow puede impedir que el crawler lo lea.
- EVIDENCE / AFFECTED FILES / MODULES: app/robots.ts; app/t/[publicTagId]/page.tsx; app/api/media/[storageKey]/route.ts; lib/uploads.ts
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Matriz por entorno/ruta/proveedor: contenido e imágenes comerciales rastreables, staging protegido, perfiles privados autorizados en servidor. Separar OAI-SearchBot de GPTBot; configuración de entrenamiento es decisión distinta. Resolver noindex/disallow sin abrir perfiles privados automáticamente.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: S–M, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-009 antes de cambiar media/crawling; acceso DNS/CDN/WAF para verificar producción.
- PRIORITY: P1
- TIMING: BEFORE LAUNCH
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: HTTP real con user agents y headers, producción/staging, imagen comercial/foto privada; no exposición PII; documentar robots no equivale a autorización ni garantiza desindexación.

## REC-035 — Páginas de servicio, contenido útil y SEO local
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: ContentPage + secciones de texto/FAQ/CTA ya cubren una página de servicio. No se inspeccionó la DB editada de Pets ni existe evidencia de un servicio local operativo o de claims técnicos.
- EVIDENCE / AFFECTED FILES / MODULES: prisma/schema.prisma:ContentPage; lib/landing-sections.ts; app/[categorySlug]/page.tsx; app/guides/page.tsx
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Usar Page con plantilla opcional Servicio/Guía, no otro subsistema. Enlaces internos página comercial → guía/FAQ → producto. Separar beneficio comercial y método de fabricación; activar personalización/NFC sólo cuando corresponda. LocalBusiness únicamente con datos pertinentes reales; no publicar domicilio particular desde configuración de shipping.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: S–M, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-008, REC-010, REC-016, REC-031; confirmación de servicios y datos del propietario.
- PRIORITY: P2
- TIMING: BEFORE LAUNCH para contenido ofrecido; WHEN NEEDED para nuevos servicios
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: Crear borrador de servicio con bloques existentes, CTA y FAQ, editable/ocultable; navegación opcional; nombre sin NFC/3D impuesto; checklist de contenido aprobado por negocio; ningún servicio falso publicado.

## REC-036 — Validación comercial por evidencia externa
- AREA: SEO / AI Search / Market Discoverability
- TYPE: OPERATIONAL RECOMMENDATION
- PROBLEM / CURRENT BEHAVIOUR: El adjunto aporta hipótesis de intención, no exportaciones de volumen, margen o competencia verificables. No hay evidencia para afirmar que un término vende más.
- EVIDENCE / AFFECTED FILES / MODULES: Pasted markdown(1).md §§189–203; modelo Product permite nombre/description/slug independientes
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Investigar fuera del CMS por Site, Australia y Adelaide cuando aplique: producto vs tecnología, intención, tendencia, competencia, precios, fabricación, envío y margen. Registrar fuente/fecha/geografía/plataforma/unidad e incertidumbre. No crear categorías por hipótesis.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: S inicial; recurrente, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: Acceso o exportaciones de herramientas de investigación; revisión del propietario.
- PRIORITY: P2
- TIMING: NOW antes de ampliar catálogo
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: Tabla de evidencia con datos ausentes como ND; separar Google/Etsy/Trends; decisión probar/descartar/esperar por línea sustentada, sin inferir ventas de volumen de búsquedas.

## REC-037 — Medición y alta en buscadores sin dashboard propio
- AREA: SEO / AI Search / Market Discoverability
- TYPE: IMPROVEMENT / GAP
- PROBLEM / CURRENT BEHAVIOUR: No se encontró en los archivos revisados flujo completo de verificación Search Console/Bing o medición por Site. Configuración externa real no inspeccionada.
- EVIDENCE / AFFECTED FILES / MODULES: app/layout.tsx; components/store-settings-form.tsx; app/sitemap.ts; despliegue por dominio
- EXISTING INTENT: CMS simple multi-site, contenido real y preservación del trabajo existente.
- REGRESSION: no determinada; revisión estática en dc80810, sin inspección del Docker del usuario.
- EXPECTED / DESIRED BEHAVIOUR / RECOMMENDED CHANGE: Preparar verificación DNS preferida o token validado por sitio, sitemap y guía de alta externa. Medir consultas/páginas/conversiones y referidos IA identificables. IndexNow opcional después, no requisito ni garantía; sin insertar scripts arbitrarios en Admin.
- WHY / BUSINESS BENEFIT: facilitar descubrimiento y decisiones comerciales con información fiable.
- USER BENEFIT: entender oferta y localizar páginas útiles con menos administración repetida.
- TECHNICAL BENEFIT: reutilizar modelos/servicios existentes con reglas comprobables.
- SECURITY IMPACT: aislar por tienda; no indexar datos de clientes ni exponer direcciones privadas.
- RISK IF NOT DONE: metadata incoherente, enlaces rotos o decisiones de inversión sin evidencia según el caso; no se promete impacto cuantificado en tráfico.
- EFFORT: S, orientativo, condicionado a acceso y pruebas.
- COMPLEXITY ADDED: limitada; sin herramienta SEO propia ni editor JSON-LD.
- DEPENDENCIES: REC-024/031/034; dominio y cuenta; consentimiento/configuración analytics definidos.
- PRIORITY: P2
- TIMING: BEFORE LAUNCH preparación; AFTER LAUNCH seguimiento
- SIMPLER ALTERNATIVE: defaults, páginas actuales y herramientas externas; automatizar sólo el fallo demostrado.
- STATUS: PROPOSED
- ACCEPTANCE: Dos sitios no comparten tokens o métricas accidentalmente; no incluir PII/NFC IDs en analytics; compra medida una vez; propiedades verificadas sólo cuando exista acceso.

## Ampliación de REC-024 (sin duplicar ID)
Sitemap debe consultar ContentPage y FAQ por tienda y estado/indexable/canonical, omitir rutas no disponibles y no fabricar alternates de traducciones inexistentes. El listado base actual incluye /guides para cualquier tienda aunque app/guides/page.tsx exige TAPKIN_STORE_ID: reproducir el 404 en segundo sitio y corregir la política común. lastModified debe reflejar cambios reales. Probar HTTP 200, self-canonical y no noindex de cada entrada, ausencia de borradores y perfiles, y fallo observable de consulta DB (actual catch devuelve listas vacías). Metadata por ruta y redirects son REC-031/033, no otro sitemap paralelo. La parte i18n de REC-024 conserva su alcance anterior.

## Ampliación REC-035 — FAQs de producto
Incluir la página /faq existente y FAQs Pets, sin página ni backlog nuevos. FAQ_CONTENT_PLAN.md contiene 30 respuestas propuestas y 16 preguntas pendientes de validación. Conservar contenido editado, evitar duplicaciones, mantener gestión en acordeones y carga idempotente por Store. No publicar promesas no verificadas. Estado PROPOSED; sólo planificación autorizada.

## Aclaración de alcance FAQ — NFC e impresión 3D
Daniel amplía el contenido a NFC e impresión 3D en general, no sólo tags/Pets. REC-035 y H1 actualizados. FAQ_CONTENT_PLAN.md contiene ahora 50 respuestas propuestas y matrices de preguntas pendientes de revisión técnica/comercial. Reutilizar /faq y módulos actuales; no anunciar servicios no ofrecidos. Documentación únicamente, sin carga en DB ni publicación.
