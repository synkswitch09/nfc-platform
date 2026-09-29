# Manual operativo y de despliegue de Tapkin

Estado: implementación actual de `develop` (17 de septiembre de 2026).

Este documento explica qué está construido en la plataforma, qué debe configurar Daniel/operaciones para usar cada módulo y cómo ejecutar, promover y desplegar la aplicación sin mezclar datos ni secretos entre Development, Staging y Production. Es el punto de partida operativo; los documentos especializados enlazados al final siguen siendo la referencia para cambios de arquitectura.

> Regla de ramas: se desarrolla en `develop`. La ruta de promoción es `develop` → `staging` → `main`; un merge a `main` se hace únicamente después de aprobación explícita y una revisión de staging. Nunca se desarrollan cambios directamente en `staging` ni `main`.

## 1. Qué es Tapkin hoy

Tapkin es una plataforma de comercio multi-marca para productos físicos impresos en 3D. La primera tienda pública es Tapkin Pets, pero el modelo permite añadir tiendas, dominios, categorías y páginas sin clonar el código.

Las tres entidades principales no son equivalentes:

| Entidad | Para qué sirve | Ejemplo |
|---|---|---|
| Categoría | Organiza la navegación, el landing y la visibilidad comercial | `Pets` |
| Producto / variante | Define lo que se vende, su precio, opciones y stock | Tag hueso, menta, tamaño S |
| NFC Tag | Unidad física ya producida/emitida y su URL pública | `https://dominio/t/ABCD…` |

Ocultar o archivar una categoría/producto impide nuevas ventas, pero no desactiva un NFC tag que ya fue vendido. El estado propio del tag controla su operación.

## 2. Módulos implementados y cómo activarlos

### 2.1 Tiendas, marcas y dominios

**Implementado**

- Resolución de la tienda a partir de un dominio verificado por entorno.
- Datos aislados por Store: catálogo, contenido, pedidos, clientes, archivos, auditoría, pagos operativos y conexiones externas.
- Temas, identidad visual, capacidades y configuración independientes por Store.
- Selector administrativo para usuarios con acceso a varias tiendas; las vistas globales son solo de Platform Admin.

**Para usarlo**

1. Cree la Store y asigne usuarios desde **Admin → System → Stores** y **Team access**.
2. Añada el dominio solamente después de que DNS/TLS esté verificado en el entorno correspondiente.
3. Active las capacidades que aplican: Commerce, Inventory, Print 3D, NFC y perfiles según el producto.
4. Para una segunda marca, cree una Store y su dominio; no copie ni cree otro repositorio.

**Importante:** no se debe confiar en un `storeId` enviado por el navegador. El host permitido es la fuente de la tienda pública.

### 2.2 Catálogo, variantes, inventario y personalización

**Implementado**

- Productos con ciclo de vida Draft, Active, Hidden, Out of stock y Archived.
- Variantes con SKU único, precio, coste, stock, reserva, política de backorder, dimensiones, material, color, tamaño, imagen y selección de opciones.
- Opciones de producto para color, tamaño, forma/estilo, texto, selectores, imágenes y suplementos de precio.
- Galería e imágenes específicas por color/variante; color swatches y selector de color en administración.
- Modos de personalización `NONE`, `OPTIONAL` y `REQUIRED`, separados de NFC. Una compra conserva el snapshot Basic o Personalised para fabricación aunque después se edite el catálogo.
- Control de stock en checkout y movimientos de inventario: recepción, reserva, liberación, venta, devolución y ajuste.

**Flujo recomendado para un tag de mascota**

1. En **Admin → Catalog → Products**, cree el producto y asígnelo a `Pets`.
2. En **Variants**, cree combinaciones reales de forma, tamaño y color. Cada combinación necesita un SKU distinto, por ejemplo `PET-BONE-S-MINT`.
3. Marque `Track inventory`, indique el stock físico y use `DENY` si no desea vender más unidades de las disponibles.
4. En **Product options**, cree `Colour`, `Size` y `Style/Shape` si el cliente los selecciona. Una variante debe coincidir con esas combinaciones.
5. Configure la personalización solo si realmente se fabrica texto/dato personalizado. NFC no debe usarse como opción de personalización.
6. Suba imágenes en **Media**/producto y asócielas al color o variante correcto.
7. Publique únicamente cuando precio, SKU, stock, peso/dimensiones y página estén revisados.

**Borrado seguro:** un producto con pedidos, tags, items de pedido o fabricación no se elimina; se oculta o archiva para conservar la trazabilidad.

### 2.3 CMS: Home, páginas, categorías, header y footer

**Implementado**

- Home, header y footer editables de forma separada en **Admin → Content → Storefront**.
- Páginas de tipo HOME, CATEGORY, CAMPAIGN, COLLECTION y LEGAL con secciones tipadas; páginas de Terms y Privacy se crean como páginas legales normales, no como botones especiales.
- Secciones: Hero, Feature badges, Benefits, Steps, Product showcase, Feature list, Media content, Story process, FAQ, CTA banner, Product grid, Category grid, Rich text, Trust strip y Stats.
- Se puede añadir, editar, mostrar/ocultar, reordenar, duplicar y borrar cada sección sin HTML ni código.
- Tipografía Inter y controles por campo para familia, peso (Thin/Light/Regular/Medium/Bold/Black/Italic) y tamaño exacto en px cuando el bloque lo admite.
- Paletas de tema pastel + negro/blanco para temas base, conservando selector de color completo para cualquier ajuste puntual.
- Header y footer: navegación, CTA, enlaces legales, enlaces personalizados, redes sociales e iconos propios subidos a Media.
- FAQ pública: combina las preguntas publicadas de las categorías con preguntas generales gestionadas desde la página `FAQ`.
- SEO: título, descripción, canonical, Open Graph, indexación y datos estructurados basados en la Store.

**Cómo editar sin confundir áreas**

| Necesidad | Lugar de administración |
|---|---|
| Inicio, logo global, navegación, footer, tipografía base | Content → Storefront |
| Página nueva, FAQ general, campaña, Terms o Privacy | Content → Pages |
| Landing específico de Pets y FAQ de Pets | Catalog → Categories → Pets |
| Precio, fotos, variantes y opciones de venta | Catalog → Products |
| Imagen que quiere reutilizar | Content → Media |

**Crear una página nueva**

1. Abra **Content → Pages → Add page**.
2. Seleccione el tipo. Use `LEGAL` para Terms/Privacy, `CAMPAIGN` para landing temporal y `COLLECTION`/página estándar para contenido permanente.
3. Defina slug, estado y dónde se mostrará en navegación.
4. Añada secciones, configure cada bloque y publique.
5. Para enlazarla desde un botón, use su ruta pública (`/slug`) o el selector de destinos internos. Para ir a una sección de la misma página, asigne/seleccione el anchor de esa sección y utilice `#anchor`.

### 2.4 Carrito, checkout, Stripe y pedidos

**Implementado**

- Carrito por sesión/cuenta, checkout como invitado o usuario registrado y precios calculados en servidor.
- Reserva atómica de inventario para checkout pendiente; se libera si el pago falla/caduca.
- Stripe Checkout y webhook firmado/idempotente para confirmar el pago.
- Pedido, pago, detalles de personalización, opciones, precio, envío y datos de fabricación congelados al momento de compra.
- Email de confirmación para cliente cuando existe email y aviso de pedido pagado al correo de soporte de la Store.
- Cliente puede reclamar un pedido como invitado y gestionar cuenta/pedidos/tags posteriormente.

**Configuración necesaria**

1. Cree claves separadas de Stripe para Development/Staging (test) y Production (live).
2. Configure `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET` en el secret store de cada entorno.
3. En Stripe, cree un endpoint por entorno que termine en `/api/stripe/webhook`.
4. Haga un pedido de prueba en Staging y confirme: pedido `PAID`, decremento de stock, trabajo de producción si aplica y correo de prueba.
5. No use `ENABLE_TEST_CHECKOUT=true` fuera de pruebas controladas; está prohibido en Production.

### 2.5 Envíos, fulfilment, etiquetas y Print Agent

**Implementado**

- Dimensiones y peso en productos/variantes, packaging, origen, zonas y servicios por Store.
- Cotización de envío de servidor para el carrito y dirección exactos; el navegador no envía un importe de envío confiable.
- Tarifas manuales/fallback, incluyendo envío gratis por reglas de importe. Es el camino inicial compatible con MyPost Business.
- Abstracción `ShippingProvider`: Manual, Mock y límite preparado para Australia Post/eParcel.
- Flujo Ready to Ship, creación idempotente de shipment/label, tracking y cola durable de impresión.
- Tapkin Print Agent autenticado que toma un trabajo, imprime una etiqueta térmica mediante el comando local y confirma el resultado.

**Configuración inicial (sin API de carrier)**

1. En **Admin → Shipping**, cree Origin, Packaging y Shipping Zones.
2. Cree servicios/tarifas manuales para Australia. Puede añadir una regla de shipping gratis a partir de un importe determinado.
3. Complete peso, dimensiones y packaging de cada variante que se venda.
4. Haga un checkout de prueba a una dirección australiana y valide el importe antes de cobrar.
5. Cuando un pedido esté fabricado, llévelo a Ready to Ship y cree su envío/etiqueta siguiendo el proveedor/manual seleccionado.

**Impresión térmica automática**

1. Conecte la impresora al PC que imprimirá (por ejemplo Zebra/GK420d/ZD421 compatible con driver del sistema).
2. En **Admin → Shipping**, registre un Print Agent y copie el token de una sola vez.
3. En ese PC, no en el servidor web, configure:

   ```bash
   TAPKIN_PRINT_AGENT_URL="https://tu-dominio"
   TAPKIN_PRINT_AGENT_TOKEN="token-de-una-sola-vez"
   TAPKIN_PRINT_COMMAND="comando-del-sistema-para-imprimir"
   TAPKIN_PRINT_ARGS_JSON='["{file}"]'
   TAPKIN_PRINTER_NAME="Nombre exacto de la impresora"
   ```

4. Ejecute `npm run print-agent` como servicio/daemon del PC.
5. Cree una etiqueta de prueba y confirme que aparece como `PRINTED` en la cola. El agente no recibe secretos de Stripe, base de datos ni sesión web.

**Aún no es una integración live de Australia Post:** para tarifas/labels live se necesitan credenciales aprobadas de eParcel Shipping and Tracking API y certificación de ese proveedor. MyPost Business puede operar al inicio con tarifas manuales y creación operativa de las etiquetas.

### 2.6 Etsy

**Implementado**

- OAuth 2.0 con PKCE; tokens cifrados en reposo y separados por Store.
- Vinculación explícita de un producto local con una listing Etsy por SKU. Se rechaza una vinculación parcial para no asignar stock a una variación equivocada.
- Creación desde Admin de listings Etsy en borrador: título, descripción, imágenes, stock, precio y hasta tres variaciones personalizadas (Colour, Size y Style) con los SKU de Tapkin. La publicación es una confirmación explícita.
- Sincronización saliente de cantidad disponible, precio, habilitación, título y descripción de cada variación vinculada.
- Importación de receipts Etsy pagados y no cancelados: crea una orden Tapkin `PAID`, movimiento de venta, decremento de inventario y trabajo de fabricación cuando aplica.
- Registro idempotente: un mismo receipt no puede restar stock ni crear dos pedidos.
- Errores visibles en Admin si hay SKU/listing no vinculado, moneda distinta o stock insuficiente.

**Cómo activarlo**

1. Cree una aplicación Etsy Open API v3 y registre exactamente `https://tu-dominio/api/admin/etsy/callback`.
2. Guarde `ETSY_API_KEY`, `ETSY_SHARED_SECRET` y un `ETSY_SYNC_SECRET` aleatorio distinto en el entorno correspondiente.
3. En **Admin → Etsy**, conecte únicamente la cuenta vendedora de la Store.
4. En **Admin → Etsy**, guarde el taxonomy ID, shipping profile ID y processing profile ID. Para tags 3D use **Create a processing profile** y seleccione `Made to order` con los días reales de producción.
5. Cree la listing desde **Create from Tapkin**. El producto necesita stock positivo, al menos una imagen y como máximo tres opciones de variante seleccionable; Tapkin usa Colour, Size y Style.
6. Revise el borrador en Etsy. Marque la casilla de publicación solo cuando el perfil de envío, fotos, texto y precio estén definitivos. También puede vincular una listing creada manualmente si sus SKU coinciden exactamente.
7. Programe cada minuto una llamada autenticada:

   ```bash
   curl -X POST "https://tu-dominio/api/integrations/etsy/sync" \
     -H "Authorization: Bearer $ETSY_SYNC_SECRET"
   ```

8. Pruebe una venta de bajo riesgo en Etsy y confirme en Admin → Orders, Inventory, Manufacturing y Etsy que se importó una sola vez.

**Límites actuales:** no actualiza Etsy como “shipped” ni devuelve tracking a Etsy. Esas acciones se implementarán cuando se defina el carrier y la política de fulfilment de producción.

### 2.7 NFC, perfiles y fabricación

**Implementado**

- Batches de producción NFC independientes del catálogo y trabajos genéricos de fabricación por Order Item.
- URL pública aleatoria permanente, QR y código de activación de un solo uso almacenado como hash.
- Estados de fabricación y de tag, panel de búsqueda, diagnóstico de scans, rotación administrada del código y auditoría.
- Perfiles Pet, Child/Emergency, Social, Business, Luggage, Review y Custom; solo se muestran datos permitidos por el propietario y el tipo de perfil.

**Para comenzar desde cero**

1. Deje el producto Pets con stock `0` hasta recibir/materializar unidades físicas.
2. No cree batches hasta tener los NFC tags físicos disponibles.
3. Cuando estén disponibles, cree el batch desde **Admin → NFC → Production batches**, descargue/guarde la hoja segura de URLs/códigos y programe cada unidad.
4. Avance el estado de fabricación y asigne el tag al Order Item solamente en el flujo de producción.
5. Si se pierde una hoja de códigos, no intente recuperarla: retire esas unidades y cree un batch nuevo.

### 2.8 Cuentas, roles, seguridad y auditoría

**Implementado**

- Contraseñas con bcrypt, sesiones opacas hasheadas, cookies HttpOnly/SameSite, reset y verificación de email.
- Google/Apple OIDC opcional con PKCE, nonce, state firmado y vinculación por email verificado.
- Roles Staff/Admin por Store, Platform Admin, protección de rutas y auditoría.
- Validación Zod, controles same-origin, rate limits, precios de servidor, firma Stripe, limitación de uploads e aislamiento Store-scoped.

**Antes de habilitar usuarios reales**

1. Configure un proveedor de email transactional (`EMAIL_MODE=live`) y verifique reset/verification reales.
2. Registre callbacks Google/Apple exactos por entorno.
3. Use secretos independientes y de 32+ caracteres para `SESSION_SECRET` y `ACTIVATION_PEPPER`.
4. Active MFA/protecciones administrativas externas y plan de alertas antes de Production.
5. No ponga contraseñas de admin, tokens de Print Agent, Stripe o base de datos en Git ni en el frontend.

### 2.9 Media, copias de contenido, backups y observabilidad

**Implementado**

- Media de producto/categoría/página validado como PNG/JPEG/WebP, máximo 5 MB y servido como URL Store-scoped `/api/media/...`.
- Borrado de media que limpia referencias y permite fallback cuando la vista tiene contenido por defecto.
- Storefront releases: exporta/importa catálogo, CMS, FAQ y media para pasar contenido entre entornos sin copiar clientes, pedidos, tags, pagos ni credenciales.
- Health checks (`/api/health/live`, `/api/health/ready`), scripts de backup/restore y CI con lint, tipos, tests, build, Docker y E2E.

**Uso correcto**

1. Use **Admin → Store settings → Storefront releases** para llevar contenido aprobado de Development a Staging; no vuelva a crear manualmente la landing.
2. Revise el preview de create/update y confirme la importación en el destino.
3. En Docker/NAS respalde tanto PostgreSQL como el volumen de uploads. En cloud, use Azure Blob privado y backup PostgreSQL.
4. Ejecute una restauración de prueba periódica fuera de Production.

## 3. Preparación de secretos y variables

Copie `.env.example` a `.env`. Nunca copie ese archivo a Git y nunca reutilice los secretos de un entorno en otro.

| Grupo | Variables principales | Cuándo son obligatorias |
|---|---|---|
| Aplicación | `APP_ENV`, `APP_URL`, `DATABASE_URL`, `DATABASE_EXPECTED_NAME` | Siempre |
| Seguridad | `SESSION_SECRET`, `ACTIVATION_PEPPER`, `TRUST_PROXY` | Siempre; `TRUST_PROXY` solo detrás de proxy confiable |
| Storage | `STORAGE_PROVIDER`, `STORAGE_ENVIRONMENT`, `UPLOAD_DIR` o Azure Blob URL/SAS | Siempre |
| Stripe | claves pública/secreta/webhook | Para cobrar con Stripe |
| Email | `EMAIL_MODE`, webhook URL/secret | Para emails reales |
| OAuth | Google/Apple client ID + secret | Si se habilita login social |
| Etsy | API key, shared secret, sync secret | Si se conecta Etsy |
| Print Agent | `TAPKIN_PRINT_AGENT_*` | Solo en PC de impresión, no en el contenedor web |

Generación local de secretos (ejemplo):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Genere uno nuevo para cada secreto y entorno.

## 4. Manual paso a paso: Development

### 4.1 Requisitos

- Git.
- Node.js 24 y npm.
- Docker Desktop/Engine para PostgreSQL local recomendado.
- Una copia del repositorio y la rama `develop`.

### 4.2 Primera instalación con Node local y PostgreSQL Docker

```bash
git clone https://github.com/synkswitch09/nfc-platform.git
cd nfc-platform
git switch develop
cp .env.example .env
```

Edite `.env`:

1. Defina `POSTGRES_PASSWORD` aleatorio.
2. Use exactamente ese password dentro de `DATABASE_URL`.
3. Cree secretos distintos para `SESSION_SECRET` y `ACTIVATION_PEPPER`.
4. Mantenga `APP_ENV=development`, `APP_URL=http://localhost:3000`, `STORAGE_PROVIDER=local` y `EMAIL_MODE=mock`.

Luego ejecute:

```bash
docker compose up -d db
npm ci
npm run config:check
npm run db:deploy
DEV_ADMIN_EMAIL="admin@example.com" DEV_ADMIN_PASSWORD="TuPasswordLocal123" npm run db:seed
npm run dev
```

Abra `http://localhost:3000`, entre en `/login` y abra `/admin`.

En PowerShell, use variables temporales:

```powershell
$env:DEV_ADMIN_EMAIL="admin@example.com"
$env:DEV_ADMIN_PASSWORD="TuPasswordLocal123"
npm run db:seed
Remove-Item Env:DEV_ADMIN_EMAIL, Env:DEV_ADMIN_PASSWORD
```

### 4.3 Desarrollo totalmente con Docker

```bash
docker compose up -d --build
docker compose --profile tools run --rm seed
docker compose ps
```

La aplicación estará en `http://localhost:3000`. El servicio `migrate` ejecuta las migrations antes de iniciar `app`.

### 4.4 Validación antes de hacer commit

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Para validar los journeys HTTP completos se necesita PostgreSQL disponible:

```bash
npm run test:e2e
```

Al cambiar `prisma/schema.prisma`, cree y revise una migration en Development:

```bash
npm run db:migrate -- --name nombre_descriptivo
npm run db:generate
```

La migration resultante se commitea. En otros entornos se usa `npm run db:deploy`, nunca `db:migrate`.

### 4.5 Reiniciar datos de prueba sin reconstruir manualmente la tienda

Desde **Admin → Store settings → Start fresh**, confirme el nombre de la Store y defina el producto inicial. El reset conserva el acceso administrativo de la Store y deja:

- una categoría publicada `Pets`;
- un producto Pets activo con una variante rastreada y stock `0`;
- sin pedidos, batches, NFC tags, fabricación, print jobs ni historial operacional de prueba.

No ejecute `db:seed` inmediatamente después de Start fresh: el reset ya crea el baseline y seed está pensado para una base Development vacía.

## 5. Manual paso a paso: Staging

Staging debe ser un entorno aislado con su propia base de datos, Blob container, secretos, dominio, Stripe test y proveedor de correo sandbox. Nunca apunte Staging a la base, media o secretos de Production.

### 5.1 Crear la primera rama y protección

1. Cuando `develop` esté aprobado, cree `staging` desde ese commit mediante pull request o el proceso de GitHub acordado.
2. Proteja `staging`: PR obligatorio, validación obligatoria, sin force push y al menos un revisor.
3. Los pushes a `staging` ejecutan `.github/workflows/staging.yml`.

### 5.2 Crear el entorno Staging (Azure Container Apps)

1. Cree base `tapkin_staging`, usuario exclusivo y URL TLS con `sslmode=require`.
2. Cree container Blob privado para staging y un SAS exclusivo.
3. Cree Container App y Container Apps Job de migración de staging.
4. Configure HTTPS/DNS para `staging.tu-dominio` y añádalo como `StoreDomain` del entorno staging.
5. En GitHub cree el Environment `staging` con OIDC/Azure y variables no secretas:
   - `AZURE_RESOURCE_GROUP`
   - `AZURE_CONTAINER_APP`
   - `AZURE_MIGRATION_JOB`
   - `APP_URL`
   - opcionalmente `SMOKE_PRODUCT_SLUG` y `SMOKE_TAG_ID`
6. Guarde los valores confidenciales en Azure Container Apps/Job, no en GitHub como texto plano.
7. Configure `AZURE_DEPLOY_ENABLED=true` solamente al terminar toda la infraestructura.

### 5.3 Variables de Staging

```text
APP_ENV=staging
APP_URL=https://staging.tu-dominio
DATABASE_EXPECTED_NAME=tapkin_staging
STORAGE_PROVIDER=azure-blob
STORAGE_ENVIRONMENT=staging
EMAIL_MODE=sandbox
```

Use Stripe test, webhook propio de staging, OAuth callbacks de staging y secretos nuevos. No use `DEV_ADMIN_*` salvo un seed de staging controlado con `ALLOW_STAGING_SEED=true` y credenciales exclusivas de prueba.

### 5.4 Promover y verificar

1. Abra un PR `develop` → `staging`; revise el diff y espere CI verde.
2. Al merge, el workflow valida, construye las imágenes runner/migrator, ejecuta la migration job una vez y despliega la imagen inmutable.
3. Ejecute smoke test y valide manualmente:
   - health live y ready;
   - Home, Pets, Shop, producto, media y navegación;
   - login/Admin/autorización;
   - checkout Stripe test, webhook, stock y pedido;
   - shipping quote, label de prueba y Print Queue si aplica;
   - NFC tag no sensible y activación de prueba;
   - Etsy solo con cuenta/listing de sandbox/prueba si está configurada;
   - emails sandbox, SEO noindex y analytics aislado.
4. Exporte desde Development e importe en Staging un **Storefront release** para contenido/catálogo aprobado. No importa clientes ni operaciones.
5. Documente el resultado y cualquier migration ejecutada antes de solicitar Production.

## 6. Manual paso a paso: Production

Production no se publica automáticamente al hacer push. Requiere PR aprobado, Environment protection y un despacho manual del workflow con `deploy=true`.

### 6.1 Pre-requisitos de lanzamiento

- Todo lo validado en Staging.
- Backup y punto de restauración comprobados.
- Términos, privacidad, consentimientos y proceso para datos infantiles revisados legalmente en Australia.
- Email live con monitoreo, Stripe live, webhook live y dominio HTTPS real.
- MFA/política de acceso de administradores, alertas, logs, backup off-site y prueba de restauración.
- Revisión de seguridad, accesibilidad, dependencia/contenedor y prueba de penetración externa.
- Sin datos demo, `DEV_ADMIN_*`, `ALLOW_STAGING_SEED` ni `ENABLE_TEST_CHECKOUT` en Production.

### 6.2 Configurar infraestructura y secretos de Production

1. Cree base `tapkin_production` y usuario que solo pueda acceder a esa base.
2. Cree Blob privado de Production y SAS exclusivo (o el mecanismo de identidad administrada cuando se adopte).
3. Cree Container App, Job de migración y dominio `tapkin.com.au`/`www` con HTTPS.
4. Cree GitHub Environment `production`, variables de Azure y required reviewers.
5. Ponga los secretos de producción exclusivamente en el secret store de Azure:

   ```text
   APP_ENV=production
   APP_URL=https://tapkin.com.au
   DATABASE_EXPECTED_NAME=tapkin_production
   STORAGE_PROVIDER=azure-blob
   STORAGE_ENVIRONMENT=production
   EMAIL_MODE=live
   TRUST_PROXY=true   # solo si el proxy está correctamente configurado
   ```

6. Registre callbacks live de Stripe, Google, Apple y Etsy con el dominio de producción exacto.
7. Configure scheduler Etsy y el Print Agent real únicamente después de las pruebas operativas.

### 6.3 Promoción controlada

1. Cree PR `staging` → `main`; no haga cambios directos en `main`.
2. Revise migrations, impacto de datos, configuración de secretos y resultados de staging.
3. Haga/valide un backup antes de la aprobación.
4. Merge aprobado a `main`: GitHub ejecuta validación, pero no despliega solo.
5. En **Actions → Validate and deploy PRODUCTION → Run workflow**, seleccione el commit de `main` y marque `deploy=true`.
6. Un revisor del GitHub Environment aprueba. El workflow ejecuta primero la migration job, luego la imagen runner inmutable y finalmente smoke tests.
7. Compruebe de nuevo salud, tienda, checkout live de importe bajo, webhooks, correo, Admin, media, etiquetas y una ruta NFC no sensible.
8. Deje Production con mínimo una réplica cuando existan tags/NFC vendidos y la disponibilidad inmediata sea importante.

### 6.4 Rollback

- Si falla la aplicación pero la migration es compatible, reactive la revisión/imagen SHA anterior y ejecute smoke tests.
- Si el problema es de datos/schema, prefiera un forward fix. No use `git revert` como sustituto de restaurar datos.
- Para una migration destructiva, restaure a una base nueva desde el punto previo, valide y repunte el servicio deliberadamente. No sobrescriba Production sin procedimiento de incidente.

## 7. Operación recurrente

| Frecuencia | Acción |
|---|---|
| Cada cambio | lint, typecheck, tests, build y revisión de diff antes de commit/push |
| Cada despliegue | migration revisada, health checks, smoke y comprobación manual del flujo afectado |
| Cada día operativo | revisar Orders, Manufacturing, Inventory, Print Queue, Etsy activity y errores de webhook |
| Semanal | revisar logs, fallos 5xx/429, stock bajo, estado de backups y gasto cloud |
| Mensual | actualizar dependencias de forma controlada, probar restore en entorno aislado, validar printer/etiquetas |
| Antes de una venta real | confirmar stock físico, SKU, precio, personalización, dimensiones, zona/tarifa y página pública |

## 8. Checklist de primera puesta en marcha de Pets

1. Ejecute Start fresh si quiere partir de cero y deje el producto con stock 0.
2. Edite la categoría `Pets`, Home, header/footer, FAQ y páginas legal desde Admin.
3. Cree variantes reales por forma/tamaño/color, SKU y stock.
4. Configure origen, packaging, Australia, tarifas y regla de envío gratis si aplica.
5. Pruebe checkout Stripe en Development/Staging.
6. Configure producción/fabricación y, cuando tenga tags NFC físicos, cree el primer batch.
7. Configure impresora/Print Agent y haga una etiqueta de prueba.
8. Conecte Etsy solo después de que cada SKU de Etsy coincida de forma exacta con Tapkin.
9. Exporte un Storefront release de Development e impórtelo a Staging.
10. Pase los launch gates y promueva de Staging a Production con aprobación.

## 9. Funcionalidades deliberadamente pendientes

Estas no son errores de configuración; requieren una fase posterior o una decisión externa:

- API live Australia Post/eParcel para tarifas, compra de etiquetas y tracking automático.
- Actualización de envío/tracking de Tapkin hacia Etsy y creación automática de listings Etsy.
- Inicio de refunds de Stripe desde administración.
- Writer NFC físico conectado directamente a la plataforma.
- Inventario de materias primas/spools y ERP/MES completo.
- MFA nativo para staff/admin, rate limiting distribuido, malware scanning de uploads y auditoría/penetration test independiente.
- Restauración/exportación lógica por Store individual y automatización IaC completa.

## 10. Referencias del repositorio

- [README](../README.md): instalación rápida y comandos.
- [Arquitectura multi-brand](architecture/multi-brand.md): aislamiento por Store/dominio.
- [Shipping y CMS](architecture/shipping-content-platform.md): límites de fulfilment y contenido.
- [Runbook Azure](deployment-azure.md): pasos detallados de infraestructura cloud.
- [Operación NAS](nas-operations.md): alternativa Docker/NAS y backups.
- [Seguridad](security.md): controles presentes y gates pendientes.
- [E2E](e2e-testing.md): journeys HTTP que cubre CI.
- [Estado de implementación](implementation-status.md): resumen técnico y aplazamientos.
