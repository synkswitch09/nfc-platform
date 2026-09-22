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
B: todavía falta allowlist integral de payload, validación/transacción de assets y round-trip DB, preview de referencias y revisión completa bootstrap. No considerar todo REC-011/014 resuelto.
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
