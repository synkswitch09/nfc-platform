# Registro de deuda y simplificación

| Deuda / REC | Origen observado | Impacto actual / futuro | Riesgo | Dificultad ahora / luego | Momento |
|---|---|---|---|---|---|
| Reservas/ajustes no centralizados 001/002 | escrituras en varios endpoints | stock ocupado o movimientos inconsistentes / peor con Etsy | alto | M / L | BEFORE LAUNCH |
| Outbox marketplace sin lease/version 005/028 | coalescing por dedupeKey | updates perdidos, jobs colgados / imposible conciliar volumen | alto | M / L | BEFORE LAUNCH |
| Releases passthrough 011 | casts sustituyen validación | stock operativo sobrescrito y nested create inválido | alto | M / L | BEFORE LAUNCH |
| Legacy Home/category y modular 010/027 | migración evolutiva incompleta | dos fuentes y fallback sorprendente | medio | M / L | AFTER LAUNCH salvo bug vacío |
| Renderer/editor extensos 016/023 | crecimiento por ajustes visuales | difícil asociar field a output / regresiones | medio | M / M | AFTER LAUNCH |
| Inventory status OUT_OF_STOCK 019 | estado comercial solapa stock | puede seguir oculto tras reponer | medio | S / M | BEFORE LAUNCH decidir política |
| Cart/CartItem y StoreSettings legacy 027 | modelos anteriores | conceptos sin dueño claro | bajo | S / M | WHEN NEEDED tras inventario de usos |
| I18n parcial 024 | traducciones incrementales | idioma mezclado / expansión costosa | medio | M / L | no anunciar idioma incompleto |
| Logs/PII/quotes sin retención 021 | sin operación de limpieza | acumulación y coste de privacidad | medio | M / L | política antes de datos reales |
| Estilos inline y CSS global 017/018 | correcciones locales | cascada/responsive impredecible | medio | S / M | BEFORE LAUNCH para móviles |
| Datos históricos producción 030 | manufacturing usa productVariant actual | cambios de material/nombre tras compra influyen en preparación | alto | M / L | BEFORE LAUNCH |
| Tests puros por encima de integración 025 | pruebas de helpers | pasa CI local sin detectar fallos de contrato | alto | M / L | BEFORE LAUNCH |

## No construir por ahora
Microservicios, Kubernetes, Kafka, event-sourcing, WMS, feature dependency engine, CMS universal, UniversalCard, marketplace genérico con plugins, optimizador 3D de empaquetado, múltiples almacenes, loyalty/POS/subscriptions, diseño visual libre tipo Webflow. Nada de esto resuelve antes los fallos comprobados.

No eliminar enum/tablas sólo por parecer antiguas: confirmar consumidores/migrations y definir compatibilidad. No rehacer contenido Pets ni borrar datos. Unificar experiencia de edición sin migración destructiva. Referencia de negocio: plataforma sencilla operable desde Admin, no paridad Shopify.
