# Auditoría de Cards y Sections

## Inventario y criterio
Hay **15 Section Types** persistidos. No equivalen a 15 Card Types. El renderer modular agrupa varios tipos; además hay tarjetas inline en Shop, Home legacy, Category legacy, perfiles, dashboard y Admin. No existe un componente UniversalCard. Contar cada `<article>` como tipo de card inflaría artificialmente el sistema.

Taxonomía propuesta: **8 contratos de dominio**: Product, Category, Feature/Information, Step, Fact, PublicProfile, OperationalSummary y Metric. QRIdentity se conserva como componente especializado del owner dashboard. FAQ es disclosure, CTA es sección; no requieren un catálogo de cards propio. No crear Testimonial hasta que existan testimonios reales y necesidad comercial.

## Mapa completo de tipos CMS
Todos se validan en lib/landing-sections.ts, se editan en components/landing-section-editor.tsx y se renderizan en components/landing-section-renderer.tsx. Datos: LandingPageSection.content JSON validado por tipo; Store/Page/category, UUID de sección, visible y sortOrder separados. Ajustes comunes: heading/copy, imágenes, acciones, theme, ancho, espaciado, tipografía. Responsive basado en CSS, no verificado visualmente en esta ejecución.

| Section Type | Propósito / datos propios | Card / variante | Estado | Decisión propuesta |
|---|---|---|---|---|
| HERO | apertura, textos, imagen, features, 2CTA | feature mini | KEEP | no fusionar con producto ni perfil |
| FEATURE_BADGES | atributos, icono/imagen/título/copy/link | Feature grid | REFACTOR | conservar variante visual, simplificar contrato editor |
| BENEFITS | beneficios con icono horizontal | Feature horizontal | MERGE | mismo propósito que feature; alias/migración sin pérdida |
| STEPS | secuencia numerada, imagen/copy | Step con número | KEEP | orden aporta significado; no simple feature decorativo |
| PRODUCT_SHOWCASE | productos/limit/featuredOnly | Product | MERGE | idéntico a PRODUCT_GRID en render actual |
| FEATURE_LIST | texto/imagen/checklist | Information checklist | KEEP | sección compuesta, no otro ProductCard |
| MEDIA_CONTENT | historia editorial e imagen | sin card obligatoria | KEEP | layout izquierdo/derecho, no tipos distintos |
| STORY_PROCESS | historia secuencial ilustrada y media | Step/story | REFACTOR | variante de secuencia a evaluar preservando diseño |
| FAQ | pregunta/respuesta visible y orden | disclosure nativo details | KEEP | no mezclar con card informativa |
| CTA_BANNER | imagen panorámica y CTA | sección | KEEP | no convertirlo en universal card |
| PRODUCT_GRID | catálogo dinámico | Product | KEEP | destino comercial/price gobernados por catálogo |
| CATEGORY_GRID | categoría e imagen/link | Category | KEEP | diferente de Product; destino category landing |
| RICH_TEXT | texto estructurado | sin card | KEEP | sin HTML libre, útil en legales |
| TRUST_STRIP | garantías breves | Feature compact | MERGE | variante compacta, no dominio nuevo |
| STATS | dato/valor/título | Fact | KEEP | identidad semántica de métricas públicas |

## Contratos mínimos propuestos
| Card | Uso / no uso | Requeridos / opcionales | Acciones | Variantes | CMS |
|---|---|---|---|---|---|
| Product | vender / no perfiles | productId,name,url,price; image,badge,availability | View product | normal/featured si difieren realmente | selección/layout, datos desde catálogo |
| Category | navegar categorías / no venta directa | categoryId,name,url; image,copy | enlace completo | image/icon | sí categoría y sección |
| Feature/Information | beneficio/contenido / no checkout | stableId,title; copy,icon,image,link | CTA opcional | tile/horizontal/compact | sí |
| Step | proceso ordenado / no feature sin secuencia | stableId,title,position; image,copy | link opcional | numbered/illustrated | sí |
| Fact | cifras/datos / no descripción larga | stableId,value,label; note | normalmente ninguna | compact/grid | sí |
| PublicProfile | identidad/contacto/lost / no catálogo | tag,perfil autorizado; photo,contacts | call/SMS/share | pet/business/emergency según dominio | visual del sitio; datos del owner |
| OperationalSummary | pedido/envío/identidad / no marketing | ID,estado,datos; acciones autorizadas | según estado | Order,Shipment,QRIdentity | no CMS público |
| Metric | métricas Admin/owner / no promesa comercial | label,value; period | filtro opcional | compact | no CMS |

## Duplicación y separación
- DUPLICATE: Product showcase vs grid; mismo shop-grid, mismo article, mismos filtros.
- NEAR-DUPLICATE: producto inline en Shop/landing y categoría en Home/modular/legacy; extraer contratos compartidos después de confirmar diferencias, no reemplazar todos por card genérica.
- NEAR-DUPLICATE: BENEFITS/FEATURE_BADGES/TRUST_STRIP; diferencias mayormente CSS/icon/compactación. Conservar variantes de presentación.
- LEGITIMATE SEPARATE: perfil público, QR owner, pedido, métrica, producto. Compartir sólo primitivas visuales si ayuda.
- STEPS/STORY_PROCESS tienen secuencia explícita; proponer variantes con mismos datos, mantener layout editorial distinto.

## Identidad, persistencia y keys
Sección DB conserva ID al reorder (API update). Duplicate genera nueva clientKey y UUID internos para items/features/textBlocks; correcto. El renderer agrega índice a keys aun con UUID: al mover una card cambia identidad React. No se reprodujo el warning histórico, y no debe declararse corregido de nuevo por lectura. Items legacy sin ID reciben default aleatorio al parse; persistir migración de IDs una vez, no durante render.

## Editor y UX
Registry ya tiene nombre, grupo y descripción: conservar. Añadir previews pequeños y campos del tipo seleccionado; editor de items comparte imagen/icon/CTA incluso donde un layout no los aprovecha. Contenido, media y acción juntos; herencia del theme por defecto; apariencia avanzada colapsada. No quitar overrides útiles ni la paleta completa. Mover column count y spacing a SECTION; identidad/textos/CTA al ITEM. No multiplicar tipos por color/borde.

## Responsive, accesibilidad e imágenes
`details/summary`, links y buttons son bases correctas. Swatches tienen aria-pressed y texto. Verificar focus visible, contraste de colores libres, zoom200%, nombres largos, un único h1 y teclado del menú. Muchos Image usan unoptimized; no se midió coste en red ni LCP. QR URL tiene ellipsis y Copy; grid padre owner mantiene mínimo260px (REC-017). Perfil sin foto tiene placeholder; una URL rota con valor no tiene onError fallback. No certificar visual sin navegador/datos.

## Prueba visual pendiente
320/375/768/1440px: Home y Pets con todos los tipos, reorder/duplicate/refresh, FAQ teclado, custom color contraste, producto sin imagen y con variantes, perfil ACTIVE/LOST/DISABLED con foto, URL QR larga. Sólo en copia aislada para no alterar datos del negocio.

## Inventario mecánico de superficies
La tabla siguiente registra archivos con clases card/panel/metric detectadas por búsqueda. Incluye contenedores y primitivas, NO representa número de tipos semánticos ni certifica todos los JSX dinámicos. Complementa el mapa de contratos anterior.

168 líneas con superficies identificadas en 63 archivos.

| Archivo | Línea | Clases / superficie |
|---|---:|---|
| `app/activate/page.tsx` | 11 | auth-card |
| `app/admin/audit/page.tsx` | 8 | admin-panel flush |
| `app/admin/categories/[categoryId]/page.tsx` | 116 | admin-panel |
| `app/admin/categories/[categoryId]/page.tsx` | 117 | panel-heading |
| `app/admin/categories/[categoryId]/page.tsx` | 161 | panel-heading |
| `app/admin/categories/page.tsx` | 12 | admin-panel flush |
| `app/admin/customers/[userId]/page.tsx` | 17 | admin-panel, panel-heading |
| `app/admin/customers/page.tsx` | 11 | admin-panel flush |
| `app/admin/inventory/page.tsx` | 10 | admin-panel flush |
| `app/admin/manufacturing/batches/[batchId]/page.tsx` | 16 | admin-panel flush |
| `app/admin/manufacturing/batches/page.tsx` | 16 | admin-panel, panel-heading |
| `app/admin/manufacturing/page.tsx` | 26 | admin-panel flush |
| `app/admin/manufacturing/page.tsx` | 40 | admin-panel, panel-heading |
| `app/admin/orders/[orderId]/page.tsx` | 30 | admin-panel, panel-heading |
| `app/admin/orders/[orderId]/page.tsx` | 31 | admin-panel, panel-heading |
| `app/admin/orders/[orderId]/page.tsx` | 34 | admin-panel |
| `app/admin/orders/[orderId]/page.tsx` | 35 | admin-panel |
| `app/admin/orders/[orderId]/page.tsx` | 36 | admin-panel |
| `app/admin/orders/[orderId]/page.tsx` | 37 | admin-panel |
| `app/admin/orders/page.tsx` | 17 | admin-panel flush |
| `app/admin/page.tsx` | 41 | admin-panel, metric-card, metric-grid, panel-heading |
| `app/admin/pages/[pageId]/page.tsx` | 175 | panel-heading |
| `app/admin/pages/page.tsx` | 111 | admin-panel |
| `app/admin/pages/page.tsx` | 112 | panel-heading |
| `app/admin/platform/page.tsx` | 24 | metric-card, metric-grid |
| `app/admin/platform/page.tsx` | 25 | admin-panel flush |
| `app/admin/products/page.tsx` | 26 | admin-panel flush |
| `app/admin/settings/page.tsx` | 47 | admin-panel danger-panel |
| `app/admin/settings/page.tsx` | 48 | panel-heading |
| `app/admin/settings/page.tsx` | 56 | admin-panel |
| `app/admin/settings/page.tsx` | 57 | panel-heading |
| `app/admin/shipping/page.tsx` | 18 | admin-panel, admin-subpanel, panel-heading |
| `app/admin/storefront/page.tsx` | 49 | admin-card-grid |
| `app/admin/storefront/page.tsx` | 51 | admin-action-card |
| `app/admin/stores/page.tsx` | 11 | admin-panel flush |
| `app/admin/tags/[tagId]/page.tsx` | 27 | admin-panel, panel-heading |
| `app/admin/tags/[tagId]/page.tsx` | 28 | admin-panel, panel-heading |
| `app/admin/tags/[tagId]/page.tsx` | 29 | admin-panel, panel-heading |
| `app/admin/tags/[tagId]/page.tsx` | 30 | admin-panel, panel-heading |
| `app/admin/tags/[tagId]/page.tsx` | 32 | admin-panel tag-qr |
| `app/admin/tags/[tagId]/page.tsx` | 33 | admin-panel |
| `app/admin/tags/[tagId]/page.tsx` | 34 | admin-panel |
| `app/admin/tags/[tagId]/page.tsx` | 35 | admin-panel |
| `app/admin/tags/page.tsx` | 25 | admin-panel flush |
| `app/admin/team/page.tsx` | 9 | admin-panel flush |
| `app/claim-order/page.tsx` | 13 | auth-card |
| `app/claim-order/page.tsx` | 15 | auth-card |
| `app/dashboard/orders/[orderId]/page.tsx` | 12 | card |
| `app/dashboard/page.tsx` | 19 | card |
| `app/dashboard/tags/[tagId]/page.tsx` | 20 | scan-metrics |
| `app/error.tsx` | 7 | auth-card |
| `app/forgot-password/page.tsx` | 1 | auth-card |
| `app/guides/page.tsx` | 15 | card |
| `app/login/page.tsx` | 9 | auth-card |
| `app/not-found.tsx` | 3 | auth-card |
| `app/order/[orderNumber]/success/page.tsx` | 26 | card receipt |
| `app/page.tsx` | 225 | category-card-grid |
| `app/page.tsx` | 228 | category-card |
| `app/page.tsx` | 277 | card step |
| `app/register/page.tsx` | 8 | auth-card |
| `app/reset-password/page.tsx` | 1 | auth-card |
| `app/shop/page.tsx` | 17 | card product-card |
| `app/t/[publicTagId]/page.tsx` | 25 | profile-card |
| `app/t/[publicTagId]/page.tsx` | 26 | profile-card |
| `app/t/[publicTagId]/page.tsx` | 62 | pet-contact-card |
| `app/t/[publicTagId]/page.tsx` | 64 | pet-urgent-card |
| `app/t/[publicTagId]/page.tsx` | 70 | profile-card |
| `components/address-manager.tsx` | 19 | card, card form, panel-heading |
| `components/admin-product-form.tsx` | 406 | admin-panel |
| `components/admin-product-form.tsx` | 407 | panel-heading |
| `components/admin-product-form.tsx` | 474 | admin-panel |
| `components/admin-product-form.tsx` | 475 | panel-heading |
| `components/admin-product-form.tsx` | 592 | admin-panel |
| `components/admin-product-form.tsx` | 593 | panel-heading |
| `components/admin-product-form.tsx` | 671 | admin-panel |
| `components/admin-product-form.tsx` | 672 | panel-heading |
| `components/admin-product-form.tsx` | 735 | admin-panel |
| `components/admin-product-form.tsx` | 736 | panel-heading |
| `components/admin-product-form.tsx` | 1023 | admin-panel |
| `components/admin-product-form.tsx` | 1024 | panel-heading |
| `components/admin-product-form.tsx` | 1218 | admin-panel |
| `components/admin-product-form.tsx` | 1219 | panel-heading |
| `components/batch-generator.tsx` | 26 | admin-panel admin-form batch-form, panel-heading |
| `components/cart-view.tsx` | 10 | card cart-empty |
| `components/cart-view.tsx` | 11 | card cart-empty |
| `components/category-delete-control.tsx` | 47 | admin-panel |
| `components/category-delete-control.tsx` | 48 | panel-heading |
| `components/category-delete-control.tsx` | 71 | admin-subpanel |
| `components/category-editor.tsx` | 181 | admin-panel |
| `components/category-editor.tsx` | 182 | panel-heading |
| `components/category-editor.tsx` | 253 | admin-panel |
| `components/category-editor.tsx` | 254 | panel-heading |
| `components/category-editor.tsx` | 303 | admin-panel |
| `components/category-editor.tsx` | 304 | panel-heading |
| `components/category-editor.tsx` | 336 | admin-panel |
| `components/category-editor.tsx` | 337 | panel-heading |
| `components/category-landing.tsx` | 24 | card product-card |
| `components/checkout-form.tsx` | 21 | card |
| `components/checkout-form.tsx` | 22 | card cart-empty |
| `components/content-page-editor.tsx` | 124 | admin-panel |
| `components/content-page-editor.tsx` | 125 | panel-heading |
| `components/content-page-editor.tsx` | 205 | admin-panel |
| `components/content-page-editor.tsx` | 206 | panel-heading |
| `components/content-page-editor.tsx` | 216 | admin-panel |
| `components/content-page-editor.tsx` | 217 | panel-heading |
| `components/etsy-manager.tsx` | 28 | admin-panel |
| `components/etsy-manager.tsx` | 29 | admin-panel |
| `components/etsy-manager.tsx` | 32 | admin-panel, panel-heading |
| `components/etsy-manager.tsx` | 33 | admin-panel |
| `components/etsy-manager.tsx` | 34 | admin-panel |
| `components/etsy-manager.tsx` | 35 | admin-panel |
| `components/etsy-manager.tsx` | 36 | admin-panel |
| `components/etsy-manager.tsx` | 37 | admin-panel |
| `components/general-faq-editor.tsx` | 107 | admin-panel |
| `components/general-faq-editor.tsx` | 108 | panel-heading |
| `components/landing-section-editor.tsx` | 205 | admin-panel landing-builder |
| `components/landing-section-editor.tsx` | 209 | panel-heading |
| `components/landing-section-editor.tsx` | 393 | admin-subpanel |
| `components/landing-section-editor.tsx` | 423 | admin-subpanel |
| `components/landing-section-editor.tsx` | 498 | admin-subpanel |
| `components/landing-section-editor.tsx` | 572 | admin-subpanel |
| `components/landing-section-editor.tsx` | 603 | admin-subpanel |
| `components/landing-section-editor.tsx` | 747 | admin-subpanel |
| `components/landing-section-editor.tsx` | 777 | admin-subpanel |
| `components/landing-section-editor.tsx` | 884 | admin-subpanel |
| `components/landing-section-editor.tsx` | 1139 | admin-subpanel |
| `components/landing-section-editor.tsx` | 1168 | admin-subpanel |
| `components/landing-section-editor.tsx` | 1170 | admin-subpanel |
| `components/landing-section-editor.tsx` | 1202 | admin-subpanel |
| `components/landing-section-editor.tsx` | 1467 | panel-heading |
| `components/landing-section-renderer.tsx` | 459 | card product-card |
| `components/landing-section-renderer.tsx` | 512 | category-card-grid |
| `components/landing-section-renderer.tsx` | 515 | category-card |
| `components/media-library.tsx` | 56 | admin-media-card |
| `components/page-translation-editor.tsx` | 14 | admin-panel locale-editor |
| `components/pet-profile-cms-form.tsx` | 18 | admin-panel, panel-heading |
| `components/pet-profile-cms-form.tsx` | 19 | admin-panel, panel-heading |
| `components/pet-profile-cms-form.tsx` | 20 | admin-panel, panel-heading |
| `components/product-image-manager.tsx` | 68 | admin-panel |
| `components/product-image-manager.tsx` | 69 | panel-heading |
| `components/product-purchase.tsx` | 86 | purchase-panel |
| `components/profile-editor.tsx` | 45 | form card |
| `components/store-reset-form.tsx` | 82 | admin-panel danger-panel |
| `components/store-reset-form.tsx` | 83 | panel-heading |
| `components/store-reset-form.tsx` | 103 | admin-panel |
| `components/store-reset-form.tsx` | 104 | panel-heading |
| `components/store-reset-form.tsx` | 113 | admin-panel |
| `components/store-settings-form.tsx` | 139 | admin-panel |
| `components/store-settings-form.tsx` | 140 | panel-heading |
| `components/store-settings-form.tsx` | 208 | admin-panel |
| `components/store-settings-form.tsx` | 209 | panel-heading |
| `components/store-settings-form.tsx` | 277 | admin-panel |
| `components/store-settings-form.tsx` | 278 | panel-heading |
| `components/store-settings-form.tsx` | 311 | admin-panel |
| `components/store-settings-form.tsx` | 312 | panel-heading |
| `components/store-settings-form.tsx` | 343 | admin-panel |
| `components/store-settings-form.tsx` | 344 | panel-heading |
| `components/store-settings-form.tsx` | 367 | admin-panel |
| `components/store-settings-form.tsx` | 368 | panel-heading |
| `components/store-settings-form.tsx` | 405 | admin-subpanel |
| `components/storefront-chrome-form.tsx` | 155 | admin-panel |
| `components/storefront-chrome-form.tsx` | 156 | panel-heading |
| `components/storefront-chrome-form.tsx` | 552 | admin-panel compact-panel typography-overrides |
| `components/storefront-release-manager.tsx` | 73 | admin-panel |
| `components/storefront-release-manager.tsx` | 74 | panel-heading |
| `components/storefront-release-manager.tsx` | 84 | admin-panel |
| `components/storefront-release-manager.tsx` | 85 | panel-heading |
| `components/tag-qr-card.tsx` | 13 | tag-identity-card |
