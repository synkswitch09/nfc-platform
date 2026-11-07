# Robot privado: Binance Spot + Interactive Brokers

Esta primera versión **solo simula operaciones**. No tiene código para enviar órdenes reales,
retirar, transferir ni convertir fondos. Configurar credenciales no activa operaciones reales.
El saldo existente en Binance/IBKR se consulta bajo demanda y nunca financia el portafolio virtual.
No se han verificado rentabilidad ni comportamiento de las cuentas reales.

## Acceso y despliegue

1. Publicar esta rama mediante PR y ejecutar la migración `20261108010000_private_trading` con
   el procedimiento habitual (`prisma migrate deploy`). No editar tablas de comercio.
2. Identificar el UUID del usuario personal, activo, verificado y con rol global `ADMIN`.
   Desde una conexión administrativa a la base de datos: `SELECT id, email, role FROM "User" WHERE email = '<tu correo>';`.
   No crear un usuario nuevo si ya existe. No usar el ID de una tienda o de un workspace.
3. En la Container App que ejecuta Next.js, configurar:

| Variable | Valor / propósito |
|---|---|
| `TRADING_OWNER_USER_ID` | UUID del propietario. Otro administrador tampoco obtiene acceso. |
| `TRADING_ENABLED` | `true` para habilitar las acciones del módulo privado. No habilita ejecución real. |
| `TRADING_BINANCE_API_KEY` | Clave **HMAC** de Binance, almacenada como secreto de servidor. |
| `TRADING_BINANCE_API_SECRET` | Secreto HMAC correspondiente. Nunca usar un prefijo `NEXT_PUBLIC_`. |
| `TRADING_BINANCE_TESTNET` | `false` para consultar tu cuenta; `true` para Spot Testnet con credenciales diferentes. |
| `TRADING_IBKR_BASE_URL` | URL privada del gateway/proxy Web API, incluyendo `/v1/api`. |
| `TRADING_IBKR_ACCOUNT_ID` | Cuenta exacta disponible en la sesión del gateway. |
| `TRADING_IBKR_PROXY_TOKEN` | Token de un proxy privado si lo requiere. No es una clave emitida por IBKR. |
| `TRADING_IBKR_PRIVATE_HTTP` | Por defecto `false`. `true` solo para HTTP en una red privada aislada y autenticada. Preferir HTTPS. |
| `ANTHROPIC_API_KEY` | Puede reutilizar el secreto que ya usa el chatbot. |
| `TRADING_AI_MODEL` | ID exacto de un modelo Claude disponible en tu cuenta. No se presupone un modelo/precio. |
| `TRADING_WORKER_SECRET` | Secreto aleatorio de al menos 32 caracteres para el scheduler. Si no se configura, se usa `CHECKOUT_RECONCILE_SECRET`. |

4. Entrar con ese mismo usuario en **`/trading` del dominio del portal de asistentes**.
   También está disponible `/admin/trading` en el panel de las tiendas, usando su sesión correspondiente.
   Los enlaces solo aparecen al propietario configurado; los demás reciben 404.
5. Datos y estado son globales para ese usuario, no una copia por tienda. Los entornos con bases de
   datos diferentes tienen simulaciones separadas. No apuntar staging y producción a la misma base.

## Binance: usar las criptos que ya tienes sin venderlas

- En Binance → cuenta → **API Management**, crear una clave **System generated / HMAC** exclusiva
  para este módulo. Completar identidad/verificaciones si Binance lo exige.
- Habilitar únicamente lectura. Mantener deshabilitados trading, retiros, margen, préstamos y transferencias.
  La simulación usa precios públicos; la clave sirve para verificar y consultar tu cuenta real.
- Restringir la clave a las IP de salida del servidor. La IP del navegador o del dominio no es necesariamente
  la IP de salida de Azure. Confirmar la IP real y su estabilidad antes de restringirla.
  Una IP fija/NAT adicional podría tener costo; no se provisiona automáticamente.
- Guardar clave y secreto mediante secretos de Azure y referencias de entorno. No pegarlos en el chat,
  frontend, repositorio, capturas, ni registros.
- Pulsar **Check read-only connection**. El saldo aparece separado del dinero virtual.
- Para probar credenciales de Testnet: crearlas en <https://testnet.binance.vision/>, y poner
  `TRADING_BINANCE_TESTNET=true`. Las credenciales reales no funcionan ahí. Testnet puede tener
  menos historia y pares que el mercado real, por lo que puede no generar señales diarias.
- Los pares disponibles dependen de tu cuenta/región y del exchange. La lectura de mercado comprueba
  símbolo, moneda de cotización y disponibilidad Spot. No utiliza futuros ni margen.

## Interactive Brokers: requiere gateway, no solo una clave

Este conector usa **Client Portal Web API**, no TWS API. Para cuentas individuales, el acceso habitual
requiere el **Client Portal Gateway**, autenticación interactiva y gestión de la sesión/2FA.
No se ha configurado OAuth institucional ni automatización de la contraseña.

1. Abrir/verificar la cuenta de IBKR y activar los permisos de acciones/ETF de las bolsas elegidas.
   Preferir una cuenta de efectivo para esta primera etapa. La elegibilidad depende de IBKR.
2. Preparar y autenticar el Client Portal Gateway en un equipo/servicio persistente accesible desde
   el backend. Puede usarse una cuenta paper de IBKR cuando esté disponible; nuestro simulador
   sigue siendo independiente y nunca envía órdenes, ni siquiera a esa cuenta.
3. Usar una ruta privada con HTTPS confiable. **No exponer públicamente el puerto 5000**, no desactivar
   la verificación TLS global de Node. Para certificados internos, configurar una CA confiable.
   Si se coloca un proxy delante, autenticarlo y restringirlo a los GET de datos requeridos y al POST de consulta `/iserver/auth/status` (no a endpoints de órdenes).
4. Configurar URL de gateway y número de cuenta. Un token de proxy, si existe, se genera y valida
   en tu proxy; el gateway por sí solo no lo interpreta como autenticación de IBKR.
5. El backend comprueba `auth/status`, lista cuentas antes de consultar el ledger y verifica que la
   cuenta configurada sea la correcta. Las sesiones pueden expirar o competir con otras sesiones:
   reautenticar cuando el panel lo indique. No se garantiza funcionamiento indefinido sin intervención.
6. Activar datos de mercado **en tiempo real y con permiso para API** para los contratos elegidos.
   Los datos gratuitos de la app no garantizan el mismo acceso por API. Pueden existir suscripciones.
   Se rechazan precios retrasados, congelados, sin fecha y prefijados con cierre anterior/parada.
   La primera petición snapshot puede iniciar la suscripción y necesitar otro ciclo.
7. Buscar el **conid** del instrumento exacto en IBKR. IVV australiano y IVV estadounidense no son
   el mismo contrato: confirmar bolsa y moneda. El conector verifica símbolo, moneda y tipo STK.
   No inventar IDs ni utilizar CFDs para sustituir un ETF real.

Fuentes: <https://www.interactivebrokers.com/docs/web-api/getting-started>,
<https://www.interactivebrokers.com/docs/web-api/authentication/introduction>.

## Configurar la simulación

- Capital inicial: AUD 1.000. Riesgo previsto por operación: AUD 5; máximo de posición: AUD 250;
  máximo una posición; pausa de entradas tras AUD 50 de caída desde el máximo del portafolio.
- Todos los instrumentos comienzan **deshabilitados**. Hay ejemplos de cripto, ETF y acción.
  Cambiar símbolos, conids, monedas y tarifas antes de habilitarlos. No hay selección automática de
  activos ni afirmación de que estos sean los instrumentos más rentables.
- El ejemplo de IVV es de ASX en AUD. Sus costos pueden consumir todo el riesgo disponible;
  el motor omitirá la entrada en vez de aumentar el riesgo. Los ejemplos de tarifas son editables,
  no una cotización contractual. Considerar cargos de terceros y las dos ejecuciones.
- La primera versión utiliza acciones enteras en IBKR. Fracciones por API deben validarse antes de
  incorporarlas. El conector no simula forex ni derivados; no habilitar un par como si fuera una acción.
- Para monedas diferentes de AUD, introducir la tasa real **AUD por una unidad de la moneda** y la
  fecha UTC de observación. USD y USDT requieren referencias separadas. **Expiran a las 24 horas**.
  Pulsar **Update reference rates only** para actualizarlas incluso con posiciones abiertas.
  No cambiar la fecha sin actualizar la cotización. Una fuente automática de FX queda pendiente;
  esta versión requiere esa actualización diaria para simular continuamente mercados no AUD.
- Los montos de apertura/cierre y comisiones se convierten a AUD. Las referencias de conversión no
  son conversiones reales del bróker y no incluyen costos reales de cambio de moneda.
- Estrategia candidata diaria: cierre sobre máximo de las 20 velas previas y media de 200 días;
  stop inicial y móvil a 2× ATR simple de 14 días; salida también al cerrar bajo el mínimo de las
  10 velas previas. Necesita al menos 201 velas diarias cerradas. Estos parámetros son hipótesis,
  no una estrategia validada ni una promesa de rentabilidad. No hay backtester en esta entrega.
- Ejecutar **Run one paper cycle**, revisar actividad y después **Start paper worker**.
  Si no hay señal o faltan datos, el bot no compra. No inventa señales para mantenerse activo.

## Ejecución continua

El proceso HTTP de Next.js no mantiene timers de trading. Se incluye un worker independiente en la
**misma imagen** para aprovechar el despliegue existente sin retrasar tareas de pedidos/chatbots.
Configurar un scheduler (por ejemplo, Container Apps Job) cada cinco minutos:

- Comando: `node /app/scripts/trading-worker.mjs`.
- Variables del job: `APP_URL` del despliegue y `TRADING_WORKER_SECRET` (mismo valor que el servidor).
  Si se reutiliza el secreto de reconciliación, configurar `CHECKOUT_RECONCILE_SECRET` en lugar del
  secreto específico en ambos lados. Nunca copiar las claves de los brokers al job HTTP.
- Imagen: la misma imagen/commit de la app, acceso al registro y red de salida al dominio de la app.
- Cron UTC: `*/5 * * * *`; paralelismo 1; timeout al menos 240 segundos. Mantener el job manual en
  staging hasta probarlo. El job adicional puede tener consumo de infraestructura; no se crea aquí.
- Alternativamente, un scheduler puede realizar POST a `/api/assistants/trading/process` con
  `Authorization: Bearer <secreto>`. No abrir ese endpoint sin autenticación.
- **Start** habilita el bot en BD; por sí solo no crea ni programa un job.

El motor usa un lease persistente con vencimiento y token de propietario, deduplicación por vela,
y confirma estado/eventos en una transacción. Un lease vencido no puede confirmar resultados.
Solo hay un portafolio compartido con el límite de riesgo entre los mercados.
**Pause entries** sigue procesando salidas; **Stop** detiene toda vigilancia simulada.
El umbral de drawdown pausa entradas, no liquida todas las posiciones automáticamente.
Para cerrar manualmente todo: detener el worker y usar **Close all paper positions**. Se requieren
cotizaciones y FX frescos; una posición sin esos datos queda abierta para reintento.

## IA y costos

Claude genera revisiones bajo demanda: máximo cuatro intentos por día UTC y uno por minuto,
700 tokens de salida por intento, con entrada acotada. Los tokens de entrada/salida y el modelo se
registran en eventos privados y no consumen cuotas de los clientes del chatbot. No usa búsqueda
web ni recibe claves/saldos de cuentas reales. No decide ni ejecuta órdenes en esta primera versión.
No se llama a Claude en cada tick. El costo depende del modelo configurado y del uso real.

## Qué falta antes de operar dinero real

- Validar la estrategia con backtests fuera de muestra y costos realistas; después observar simulación.
- Fuente automática de FX y datos adecuados a cada sesión/mercado; alertas operativas y de datos obsoletos.
- Implementar ejecución real idempotente con reconciliación de órdenes/reintentos, fills parciales,
  mínimos/tamaños de lote, efectivo liquidado, posiciones personales protegidas y stops del bróker.
- Validar horarios, calendarios, permisos, custodia y operaciones fraccionadas por API.
- Probar todo en entornos de prueba y mantener deshabilitado cualquier retiro.

**No existe un interruptor oculto de live trading.** Esta entrega proporciona conexiones de lectura,
panel privado y simulación persistente. Añadir claves o pulsar Start nunca compra ni vende dinero real.

## Validación de esta entrega

- Lint, comprobación de tipos y compilación de producción completados localmente.
- 909 pruebas unitarias/de integración con mocks pasan, incluyendo 20 pruebas nuevas de trading.
- Smoke HTTP local: consultas sin sesión devuelven 404; escritura de otro origen 403; worker sin secreto 401.
- `scripts/check-private-trading.ts` añade comprobaciones contra PostgreSQL desechable a CI
  (concurrencia, deduplicación persistente, controles, actualización de FX y revocación del propietario).
  Esa prueba necesita PostgreSQL y queda pendiente de ejecutar en CI; no se ha probado con una base real aquí.
- Las conexiones reales a Binance, IBKR y Claude quedan pendientes de las credenciales/configuración del propietario.
