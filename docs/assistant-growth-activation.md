# Tapkin Assistants: manual de activación y operación

Fecha de revisión: 6 de noviembre de 2026, Adelaide. Público: administrador de la plataforma y dueño de un pequeño negocio.

## Qué queda disponible

La entrega amplía el portal existente sin reemplazar sus conexiones de Instagram, Facebook, WhatsApp, chat web, facturación ni base de conocimiento.

| Área             | Comportamiento implementado                                                                                                                                   | Dependencia para uso real                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Clientes         | Guardar desde Inbox, necesidades, etapa, permiso, exclusión y próximo paso                                                                                    | Migración de base de datos                                                                     |
| Campañas         | Objetivo, oferta, entrenamiento, saludo, preguntas, objeciones, límites, idioma y país; simulación privada                                                    | Claude para simulación                                                                         |
| Campañas de chat | Asignación a conversación privada; primer mensaje revisado, una vez por cliente/campaña; siguientes respuestas usan la versión aprobada                       | Canal activo, permiso vigente, ventana de mensajería y bandera de activación                   |
| Contenido        | Ideas, captions, guiones, shot lists, investigación con fuentes, análisis de últimos 20 posts de la cuenta y planificación                                    | Claude; búsqueda habilitada para investigación; Meta para posts propios                        |
| Publicación      | Posts y carruseles de imágenes en IG/FB; Reels en IG/FB; Stories de imagen/vídeo en IG; aprobación separada de publicación y programación                     | Permisos de publicación aprobados por Meta, medios públicos y worker                           |
| Telegram         | Bot oficial, recepción de DM, Claude, Inbox, respuesta humana, pausa y desconexión                                                                            | Token de BotFather y configuración de cifrado social                                           |
| Voz              | Catálogo de voces; creación desde audio autorizado; revisión; agente con Claude; llamada individual opt-in; historial, transcripción y revisión del resultado | ElevenLabs + línea Twilio importada; revisión de cumplimiento y límites                        |
| Idiomas          | Preferencia de idioma/país por negocio y campaña; adaptación al mensaje                                                                                       | Voz limitada a los 32 idiomas del modelo de audio seleccionado; chat según capacidad de Claude |
| Tareas           | Pendientes internos con fecha, cliente y estado                                                                                                               | No envía mensajes ni notificaciones por sí sola                                                |

**No está implementado:** generación automática de las imágenes/vídeos finales; publicación directa de Facebook Stories; sincronización de CRM externos; disparadores por palabra clave en posts específicos; campañas masivas autónomas; reintentos automáticos de llamadas; contratación/pagos por llamada; voz conversacional en un widget público de navegador; recomendaciones de horario sustentadas en métricas de alcance/conversión. No se presentan estas funciones como conectadas. Los guiones y planes sí cubren los formatos mencionados; los medios se aportan por URL y Facebook Stories puede exportarse para publicación manual.

El chat no promete dominio perfecto de todos los idiomas. En voz se ofrece cambio entre idiomas soportados y salida a humano cuando la comprensión sea insuficiente. La apertura estándar está localizada en inglés y español; otros idiomas requieren revisar y probar la introducción antes de habilitar una campaña real.

## 1. Preparar Azure y la base de datos

1. Revisar el PR y dejar pasar CI: incluye pruebas con PostgreSQL descartable y servicios externos simulados.
2. Hacer un backup de producción.
3. Ejecutar la migración mediante el proceso de despliegue existente: `npm run db:deploy`. La migración `20261106000000_assistant_growth` agrega columnas con valores por defecto y una tabla nueva; no elimina datos existentes.
4. Desplegar el código y verificar acceso a `https://admin.tapkin.com.au/account` con la cuenta verificada correspondiente.
5. Comenzar con las funciones que generan cargos desactivadas; habilitarlas una por una después de las pruebas de este manual.

En Azure Container Apps: abrir la aplicación de producción, **Settings → Secrets** para secretos, después **Containers → Edit and deploy → Environment variables** para referencias. Crear una revisión nueva al cambiar configuración. Los nombres de variables del código deben ser exactos; los nombres de los secretos de Azure pueden ser descriptivos en minúsculas.

| Variable                                | Tipo    | Activación inicial                                                                               |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `AI_ASSISTANTS_GROWTH_ENABLED`          | Bandera | `true` al habilitar campañas y exclusiones de contactos                                          |
| `AI_ASSISTANTS_RESEARCH_ENABLED`        | Bandera | `false`; luego `true` tras habilitar Web search en Anthropic y revisar presupuesto               |
| `AI_ASSISTANTS_META_PUBLISHING_ENABLED` | Bandera | `false`; luego `true` tras aprobación de permisos de Meta                                        |
| `AI_ASSISTANTS_VOICE_ENABLED`           | Bandera | `false`; luego `true` con proveedores y pruebas                                                  |
| `ELEVENLABS_API_KEY`                    | Secreto | API key privada, con permisos mínimos para voces, agentes, conversaciones y telefonía necesarios |
| `ELEVENLABS_WEBHOOK_SECRET`             | Secreto | Secreto HMAC del webhook creado en ElevenLabs                                                    |
| `AI_ASSISTANTS_MAINTENANCE_SECRET`      | Secreto | Aleatorio, al menos 32 caracteres; compartido sólo con el job                                    |

Se conservan las variables existentes: `ANTHROPIC_API_KEY`, modelos autorizados en `AI_ASSISTANT_MODELS`, `AI_ASSISTANTS_ORIGIN`, `AI_ASSISTANTS_ENABLED`, y configuración Meta documentada en `docs/assistant-meta.md`. No copiar claves en prompts, conversaciones, repositorio ni capturas.

Telegram reutiliza el cifrado social existente: requiere `AI_ASSISTANTS_META_TOKEN_KEY` de al menos 32 caracteres y configuración Meta lista. Es una dependencia de esta implementación aunque el canal sea Telegram. Cambiar esa clave sin migrar los tokens cifrados obliga a reconectar canales.

## 2. Claude y control de gasto

No hay otro proveedor LLM para chat, borradores o investigación. El agente de voz también configura Claude, mediante ElevenLabs. La voz y la telefonía se cobran por separado y no se incluyen en la suscripción actual de Tapkin.

1. Mantener la API key de Anthropic existente y un modelo permitido para el negocio.
2. Para investigación, habilitar Web search en la organización de Anthropic y después `AI_ASSISTANTS_RESEARCH_ENABLED=true`.
3. Configurar límites de gasto en el proveedor y revisar alertas. La búsqueda usa `web_search_20250305`, máximo dos búsquedas por petición, sin otro motor de IA.
4. Los borradores tienen una bolsa separada: 50 solicitudes mensuales con servicio activo y 5 sin acceso activo. Las simulaciones e investigaciones cuentan en esa bolsa. Una solicitud fallida puede mantener la reserva para evitar sobreconsumo en casos ambiguos.
5. Las respuestas a clientes conservan el límite del plan existente; no se cambian precios ni cuotas de Responde/Agenda.

No se generan estadísticas ficticias. La investigación devuelve fuentes cuando Claude las proporciona; si la búsqueda no está configurada, muestra un error de activación. Revisar fechas y pertinencia de las fuentes. El análisis de cuenta lee hasta 20 posts y sus fechas/captions; **no tiene métricas de audiencia o conversiones**. Los horarios sugeridos son experimentos que deben medirse.

## 3. Conectar Telegram

1. Abrir Telegram y buscar **@BotFather** oficial, verificado.
2. Usar `/newbot`, elegir nombre y usuario. Conservar el token en privado.
3. En el portal: **Channels → Telegram → Connect a bot**. Pegar el token.
4. Marcar reemplazo de webhook sólo si se desea trasladar ese bot desde otro sistema.
5. El bot se conecta pausado. Publicar la información del negocio y activar respuestas cuando el servicio esté activo.
6. Desde otra cuenta, abrir el bot, pulsar **Start** y escribir una consulta real.
7. Verificar Inbox, tomar control humano y probar una respuesta manual.

El bot no puede iniciar conversaciones con personas que no lo hayan abierto. Sólo se procesan mensajes de texto privados; grupos, archivos y audio no se presentan como soportados. Un bot pertenece a un negocio a la vez y utiliza una plaza de canal de su plan.

## 4. Meta y publicación

1. Resolver la verificación del negocio y la revisión de la aplicación de Meta en el proceso oficial. El código no las sustituye.
2. Solicitar acceso requerido para los canales ya conectados. Para publicar: `instagram_content_publish` en Instagram con Facebook Login y `pages_manage_posts` para Facebook Pages.
3. Habilitar la bandera de publicación y **reconectar** el canal; activar la bandera no agrega permisos al token antiguo. Mantener los permisos existentes de mensajería.
4. Usar una cuenta profesional de Instagram vinculada a la Page. Instagram Stories puede requerir cuenta Business, no Creator, según las condiciones de Meta.
5. Alojar imágenes/vídeos aprobados en un servidor HTTPS público accesible al crawler de Meta. Instagram exige formatos, proporciones, duración y tamaño compatibles; usar JPEG para imágenes y probar vídeos antes de programar. No usar enlaces a carpetas privadas o páginas que requieran login.
6. Crear el borrador en **Content studio**, revisar textos y medios, guardar y aprobar la versión.
7. Pulsar **Publish approved content** o **Schedule publication**. Guardar una fecha por sí solo no programa nada.
8. Revisar el historial de fases. **Check / continue** avanza una fase segura. `UNCERTAIN` requiere revisar la cuenta/proveedor antes de volver a publicar. No crear otro borrador para eludir este control.

La publicación usa contenedores y procesamiento asíncrono. La fecha programada es el momento a partir del cual comienza el proceso, no garantía de publicación al segundo. Los carruseles soportados aquí son de 2–10 imágenes. Facebook Stories y los carruseles mixtos vídeo/imagen se exportan para gestión manual. La publicación no usa el toggle de respuestas automáticas del canal; pausa la publicación o el negocio para detener fases futuras.

**Pausa:** detiene fases pendientes; una solicitud ya enviada al proveedor puede completar. No borra una publicación existente. La reconciliación de un resultado ambiguo es manual: verificar el post, contenedor o vídeo en Meta, registrar la evidencia y corregir el registro mediante soporte antes de lanzar de nuevo.

## 5. Worker de programación y retención

Configurar un Azure Container Apps Job o tarea equivalente **cada minuto** para:

`POST https://admin.tapkin.com.au/api/assistants/growth/maintenance`

Header: `Authorization: Bearer <AI_ASSISTANTS_MAINTENANCE_SECRET>`.

No colocar el secreto en la URL. Reutilizar el patrón de autenticación del mantenimiento existente, no exponer un endpoint anónimo. Este worker es adicional al mantenimiento de facturación/social; no sustituye los jobs anteriores.

Avanza publicaciones por fases, limita trabajo por ejecución y purga transcripciones vencidas en lotes de 100. Una fase `IN_FLIGHT` abandonada pasa a `UNCERTAIN`; no se reenvía automáticamente. Monitorizar errores y backlog; si el worker no funciona, las programaciones no avanzan y la eliminación de transcripciones se demora. La retención efectiva es siete días más el intervalo de ejecución, y más si hay backlog o fallos del job.

La eliminación automática de un workspace no puede borrar registros mientras haya recursos de voz externos activos: antes hay que desactivar telefonía/agentes y borrar voces en el proveedor. Esto evita dejar servicios externos cobrando sin referencia local.

## 6. ElevenLabs y Twilio

### Cuentas y línea

1. Crear una cuenta de **ElevenLabs** y otra de **Twilio** por el administrador. Revisar acuerdos de procesamiento, ubicaciones y subprocesadores antes de enviar datos reales.
2. Para aprender, usar créditos/minutos de prueba e interlocutores propios. Para uso comercial y clonación, elegir un plan que incluya los derechos y funciones necesarios. No asumir que el plan gratuito permite uso comercial ni que todo crédito TTS equivale a minutos de Agents.
3. En Twilio obtener una línea autorizada y completar la documentación regulatoria solicitada para Australia/Colombia. Los números de prueba y llamadas salientes pueden estar restringidos.
4. Importar la línea Twilio en ElevenLabs conforme a su integración oficial. La cuenta Twilio puede requerir Account SID/Auth Token **en ElevenLabs**; Tapkin no pide estas credenciales en el navegador del cliente.
5. Copiar el **phone number ID de ElevenLabs**, no el número E.164, al panel de activación del negocio. Una línea no puede asignarse simultáneamente a dos negocios desde Tapkin.
6. Definir límites de saldo/gasto en Twilio y ElevenLabs, además de la cuota del portal. Una cuota de minutos no es un tope monetario garantizado: números, redondeos, voz, modelo, extras e impuestos se facturan por proveedor.

### Webhook

En ElevenLabs crear webhook HMAC:

`https://admin.tapkin.com.au/api/assistants/voice/webhook`

Elegir **post_call_transcription**. No enviar el audio completo: Tapkin no lo necesita y limita el tamaño de entrada. Copiar el secreto generado a `ELEVENLABS_WEBHOOK_SECRET`. Los agentes deben usar ese webhook por configuración del workspace en ElevenLabs. Revisar que siga habilitado después de pruebas fallidas.

Tapkin valida HMAC y antigüedad de cinco minutos, resuelve el negocio por el agente registrado, relaciona llamadas con `tapkin_call_id`/conversation ID y no procesa un webhook duplicado como llamada nueva. Las llamadas fallidas sin transcripción pueden quedar `STARTED` o `UNCERTAIN`; reconciliarlas en el dashboard del proveedor y registrar una revisión. No se inventa una conversación completada.

### Voces y autorización

1. En **Voice & calls**, revisar el catálogo; en la campaña elegir una voz estándar.
2. Para voz propia, subir 1–3 grabaciones claras (máximo 10 MB), declarar autorización explícita y registrar la referencia donde se conserva la prueba del titular.
3. No subir voces de terceros, empleados o clientes sin permiso específico para voz sintética y uso comercial en esas campañas.
4. La creación deja la voz en `REVIEW_REQUIRED`. El administrador revisa autorización e identidad con evidencia independiente. Si ElevenLabs exige verificación del hablante, completarla allí; Tapkin no la salta.
5. El administrador aprueba la voz después de esa revisión. La plataforma no puede acreditar por sí sola la titularidad de una voz a partir de un checkbox.
6. Revocar una voz impide nuevas llamadas con esa voz y solicita borrarla al proveedor. Si el borrado remoto falla, queda `REVOKED` y debe reconciliarse; no se presenta como eliminada.

Los audios de muestra se envían a ElevenLabs y no se guardan localmente. El proveedor puede conservar muestras y modelos hasta su eliminación conforme a su política; la retención de transcripciones de llamadas es distinta.

### Primera llamada

1. Crear cliente con teléfono E.164, país y zona horaria reales.
2. Registrar permiso vigente para voz, evidencia y fecha; registrar también autorización previa para procesamiento de audio y retención de transcripción. Un saludo posterior no corrige la falta de autorización previa.
3. Crear campaña de voz con objetivo, oferta, entrenamiento, límites y voz. Guardar, simular y aprobar.
4. En **Voice & calls**, preparar el agente de esa versión. No se llama a nadie al prepararlo.
5. Administrador: verificar restricciones, establecer evidencia y fecha de vigencia de revisión, cargar todos los festivos nacionales/locales aplicables al periodo cubierto y fijar una cuota pequeña, por ejemplo 6 minutos.
6. Elegir un contacto incluido y confirmar **una llamada facturable**. Se permiten sólo callbacks/opt-in AU/CO durante días laborales locales 09:00–17:00, sin festivos configurados, con un máximo de tres minutos por llamada y reserva conservadora de tres minutos.
7. Revisar el proveedor y el historial. Registrar seguimiento, rechazo, no respuesta o exclusión de contacto. Una llamada completada no se marca automáticamente como venta.
8. No hay reintentos automáticos ni llamadas repetidas al mismo número en esta entrega, incluso si se crea otra campaña. Ampliar esto requiere un flujo adicional de revisión/cadencia y cumplimiento.

El agente se crea privado, sin grabación de audio, con retención del proveedor de siete días, detección de idioma y herramienta de terminar llamada. No tiene herramientas de cobro, contratación ni reserva real. Puede facilitar el enlace de reservas y solicitar devolución de llamada humana; no promete una transferencia telefónica en vivo.

La ruta entrante de telefonía se puede configurar en el proveedor usando el agent ID registrado, pero **no se habilita automáticamente**: hacer pruebas de privacidad, identificación y límites allí. La cuota local de llamadas salientes no limita tráfico entrante ni llamadas iniciadas directamente fuera de Tapkin. No se incluye un widget público de voz web.

## 7. Campañas de chat

1. Desde Inbox guardar la conversación privada como cliente. Al crear un cliente manual sin conversación no se inventa su identidad de Instagram/Facebook/Telegram.
2. Registrar permiso y evidencia reales; no se extrae consentimiento de un saludo ni de un formulario de contacto genérico.
3. Preparar la campaña: objetivo, oferta, instrucciones, saludo, preguntas, objeciones y límites. Seleccionar clientes, idioma, país y zona horaria.
4. Probar un mensaje privado en varios idiomas y un rechazo. Guardar y aprobar la versión.
5. **Assign future replies** aplica la campaña a futuros mensajes de ese cliente en ese hilo privado. No envía un mensaje por sí sola. La versión aprobada queda fijada; pausar o editar requiere aprobar/asignar de nuevo.
6. **Send reviewed message** solicita un único primer mensaje revisado. Se aplican permiso vigente, exclusión, horarios conservadores 09:00–17:00 laborables y ventanas del proveedor. No hay envío masivo autónomo.
7. En Instagram/Facebook/WhatsApp este flujo no evita la ventana de respuesta del canal. Para iniciar WhatsApp fuera de ventana harían falta plantillas aprobadas y otro flujo, que no se presenta como implementado.
8. **Take over** mantiene control humano. La campaña no puede reactivar una conversación o canal pausados.

Las frases explícitas de baja reconocidas por la plataforma, como STOP/unsubscribe/no me contacten, pausan el hilo y marcan los contactos vinculados cuando Growth está activado. No es un detector perfecto para todos los idiomas: revisar solicitudes de baja y usar **Do not contact** ante cualquier duda. El prompt obliga a respetar rechazo y derivación humana; las barreras de consentimiento y estado están también en código.

## 8. Condiciones para campañas reales en Australia y Colombia

La actividad de call center y el uso de voz sintética son viables, sujetos a reglas de marketing, privacidad, grabación/procesamiento, contratos y sector. Estas comprobaciones son parte de la activación de cada negocio y campaña; el software no certifica cumplimiento legal.

**Australia:** comprobar Do Not Call Register y base válida de consentimiento/exención; conservar pruebas y revisión vigente. No asumir consentimiento por publicar un teléfono. Aplican estándares de identificación, caller ID, horarios y finalización a petición, incluso en situaciones B2B o números no inscritos. En general el registro debe comprobarse dentro de los 30 días anteriores cuando corresponda. Los máximos habituales de telemarketing son lunes–viernes 09:00–20:00 y sábado 09:00–17:00, sin domingos/festivos nacionales; este código usa una ventana menor, no una excepción automática para llamar. En SA y otros estados revisar reglas de escucha, grabación y consentimiento: no guardar audio no convierte su procesamiento en automáticamente permitido. Revisar especialmente servicios financieros, seguros, salud y contratación no solicitada.

**Colombia:** revisar Ley 2300 de 2023, protección de datos, autorización, canales admitidos y RNE. Los horarios legales generales citados por la norma son lunes–viernes 07:00–19:00 y sábado 08:00–15:00, sin domingos/festivos; la plataforma es más restrictiva. Revisar las nuevas obligaciones de identificación de llamadas comerciales de CRC, incluida Resolución 8308 de 2026 y sus fechas de implementación, antes de lanzar. El código no consulta automáticamente DNCR/RNE ni verifica proveedores de listas.

El idioma o país del negocio no sustituye la ubicación real del destinatario. Las campañas internacionales deben evaluar las reglas del destinatario. Las llamadas desde proveedores extranjeros hacia Australia no quedan fuera de sus reglas por ese motivo. Para el primer lanzamiento: callbacks solicitados, muestras pequeñas y sin aceptar pagos/contratos en llamada.

## 9. Comparación de proveedores y coste inicial

Precios de referencia consultados el 6 de noviembre de 2026; moneda y componentes se deben comprobar en checkout. No son cotización contractual ni prueba de que un stack sea universalmente el más barato.

| Opción investigada                | Coste/alcance observado                                                                                                                     | Evaluación para el inicio                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude directo                    | Modelo y tokens existentes; Web search tiene tarifa adicional                                                                               | Mantener para chat, preparación e investigación; evita otra IA de conversación                                                                    |
| ElevenLabs Agents + Twilio        | Free con 15 min para probar; Starter publicado a US$6/mes y 75 min. Telefonía, LLM y funciones/consumos adicionales se revisan por separado | Implementado: reúne voces, clonación autorizada, idiomas y agente; validar plan comercial/clonación, no asumir todo incluido                      |
| Twilio AU                         | Referencia de salida: US$0.0252/min a fijo y US$0.0750/min a móvil, más número y servicios adicionales                                      | Implementado mediante importación de línea en ElevenLabs. El coste móvil cambia mucho el total                                                    |
| Telnyx Voice AI                   | Publica motor de voz desde US$0.05/min; revisar modelo/telefonía y redondeo separados                                                       | Candidato de ahorro a volumen; no integrado ni probado en esta entrega. No comparar sólo el precio del motor                                      |
| Retell AI                         | Publica rango de US$0.07–0.31/min según configuración                                                                                       | Alternativa gestionada; añadiría otro runtime de agentes sin resolver por sí solo consentimiento o telefonía                                      |
| Azure Speech / Personal Voice     | Precios por servicio/región; Personal Voice exige consentimiento y acceso/condiciones aplicables                                            | Aprovecha ecosistema Azure, pero añade orquestación de audio/telefonía y proceso de voz personalizada; no es automáticamente la opción más barata |
| Twilio ConversationRelay + Claude | Orquestación de audio adicional por minuto, además de telefonía/modelo                                                                      | Exige servidor WebSocket y operación adicional; se evitó para reducir trabajo y coste fijo inicial                                                |

Comenzar usando chat + borradores con Claude; habilitar voz sólo para una prueba de baja cuota, sin reservar infraestructura WebSocket adicional. No comprar planes grandes ni agregar varios proveedores LLM al comienzo. Medir coste por contacto interesado, cita confirmada y venta real, no sólo número de mensajes.

## 10. Prueba de aceptación de Daniel

- Instagram/Facebook/WhatsApp/chat web existentes siguen respondiendo después del despliegue.
- Guardar cliente desde Inbox; crear tarea; confirmar que una venta exige evidencia.
- Preparar campaña en inglés para AU y probar preguntas en español; repetir al revés. No confundir simulación con envío.
- Probar toma de control humano, pausa de canal, exclusión y permiso vencido; todos deben impedir envíos indebidos.
- Conectar Telegram y escribir desde una cuenta real después de Start.
- Investigar un nicho con fuentes y analizar posts propios. Verificar que no se inventan métricas de alcance.
- Publicar primero en una cuenta de pruebas un post y luego un Reel. Probar también programación y pausa. Revisar por separado formatos y restricciones de ambas plataformas.
- Verificar que dos clics no crean dos publicaciones ni dos llamadas.
- Probar voz sólo con interlocutor propio y permiso documentado. Revisar acento, identificación de IA, rechazo, idioma y webhook.
- Verificar worker, purga de transcripciones y cuotas con datos de prueba antes de abrir llamadas a clientes.

## Fuentes oficiales y referencias

- [Claude Web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [ElevenLabs Agents pricing](https://elevenlabs.io/pricing/agents)
- [Twilio Australia pricing](https://www.twilio.com/en-us/voice/pricing/au)
- [Telnyx Voice AI pricing](https://telnyx.com/pricing/voice-ai-agents)
- [Retell pricing](https://www.retellai.com/pricing)
- [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [Azure Personal Voice](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/personal-voice-overview)
- [ElevenLabs create agent](https://elevenlabs.io/docs/api-reference/agents/create)
- [ElevenLabs language detection](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/language-detection)
- [ElevenLabs voice creation](https://elevenlabs.io/docs/api-reference/voices/ivc/create)
- [ElevenLabs Twilio outbound](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call)
- [ElevenLabs post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
- [Meta Instagram official Postman collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Meta Facebook Reels samples](https://github.com/fbsamples/Facebook-Reels-Publishing-API-Postman-Collection)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Do Not Call Register: industry standards](https://www.donotcall.gov.au/industry/industry-overview/industry-standards)
- [Do Not Call Register: consumer FAQs](https://www.donotcall.gov.au/consumers/faqs-for-consumers)
- [OAIC: commercial AI guidance](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/more-guidance/guidance-on-privacy-and-the-use-of-commercially-available-ai-products)
- [WhatsApp Business messaging policy](https://business.whatsapp.com/policy)
- [CRC Colombia](https://www.crcom.gov.co/)
