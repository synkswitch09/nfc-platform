# Entrega de crecimiento de Tapkin Assistants

## Lectura del requerimiento

Ampliar el producto existente para pequeños negocios, con menor complejidad que MyChatBot: conectar canales, atender conversaciones, organizar oportunidades y tareas, entrenar campañas, preparar/publicar contenido y añadir voz autorizada. Mantener Claude como modelo de conversación y contener costes. Conservar la identidad y los flujos anteriores. El manual de activación identifica los pasos que requieren cuentas, permisos y pruebas del propietario.

## Aporte de cada rol

| Rol                               | Decisión aplicada                                                                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente / usuario final           | Encontrar qué necesita atención; guardar una oportunidad sin rehacer la conversación; ver claramente qué está listo, pausado o pendiente de conectar. Evitar terminología de herramientas y prompts como requisito para tareas simples. |
| Stakeholder                       | Priorizar resultados verificables: próximo paso, permiso, seguimiento y venta confirmada. Mantener planes actuales; no añadir proveedores LLM ni servicios permanentes de audio propios.                                                |
| Product Owner                     | Separar borrador, prueba, aprobación y envío/publicación. Fijar la versión de campaña; usar criterios de aceptación comprobables y permisos por negocio.                                                                                |
| UX/UI                             | Reutilizar identidad del portal, jerarquía y tarjetas; formularios con etiquetas y estados; selector de navegación en móvil/tablet, foco y scroll al editar; cambios sin guardar protegidos.                                            |
| Desarrollo                        | Migración aditiva, contratos Zod, rutas autenticadas por workspace, adaptadores de proveedor, reservas y fases persistentes para operaciones externas.                                                                                  |
| QA                                | Regresión del sistema existente; pruebas nuevas de permisos, consentimiento, límites y firmas; verificación visual de escritorio, móvil/tablet con datos sintéticos; concurrencia con PostgreSQL en CI.                                 |
| Arquitectura / DevOps / seguridad | Credenciales sólo en servidor; cifrado social existente; callbacks firmados; aprobación de voz; funciones con coste desactivadas por defecto; límites de trabajo y retención; no reintentar operaciones ambiguas.                       |

## Requisitos y criterios de aceptación

| Prioridad | Historia de usuario                        | Criterio verificable                                                                                                                                              |
| --------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | Como dueño, quiero conservar lo que ya uso | La suite previa de chat, Meta, WhatsApp, facturación, tienda y separación de hosts sigue pasando                                                                  |
| P0        | Quiero organizar clientes desde el chat    | Guardar desde Inbox mantiene vínculo con la conversación; no inventa correo, teléfono ni consentimiento                                                           |
| P0        | Quiero ver resultados reales               | Etapa de venta requiere referencia o confirmación; métricas de UI indican su alcance en registros cargados                                                        |
| P0        | Quiero entrenar una campaña                | Puede definir objetivo, oferta, tono, saludo, preguntas, objeciones, límites, idioma y país; probar sin enviar                                                    |
| P0        | Quiero revisar antes de enviar             | La versión debe estar aprobada; opt-out, estado, consentimiento, canal y ventana se revalidan en servidor                                                         |
| P0        | Quiero controlar gastos de llamadas        | Voz desactivada sin configuración; límite mensual reservado, máximo de campaña y llamada de tres minutos; doble envío y números ya intentados quedan bloqueados   |
| P0        | Quiero usar una voz propia con permiso     | Audio acotado, evidencia de autorización, revisión administrativa y verificación del proveedor cuando la exige; ninguna voz de otro workspace aparece como propia |
| P1        | Quiero trabajar desde móvil                | Formularios sin desbordamiento horizontal; navegación directa, labels y foco visibles, respeto por movimiento reducido                                            |
| P1        | Quiero ideas fundamentadas                 | Claude puede buscar fuentes con máximo dos búsquedas; análisis de posts propios separa hechos de hipótesis                                                        |
| P1        | Quiero aprobar y programar contenido       | Fecha sola no programa; acción separada crea trabajo versionado; pausa cancela fases futuras; resultado ambiguo exige revisión                                    |
| P1        | Quiero Telegram                            | Bot autenticado, webhook secreto, deduplicación por update, DM a Inbox, respuesta humana y pausa independientes                                                   |
| P1        | Quiero asistentes multilingües             | Preferencias por workspace/campaña; mensajes adaptados; la voz expone sus idiomas soportados, sin prometer todos los idiomas posibles                             |
| P1        | Quiero recordar compromisos                | Tareas y próximo paso con fechas; no aparentan enviar recordatorios externos                                                                                      |

## Cambio técnico

- `AssistantWorkspace`: idioma, país y zona horaria con valores por defecto compatibles.
- `AssistantResource`: datos validados por clase, relación al negocio, versión, estado e identificador externo para evitar duplicados.
- `lib/assistants/growth`: contratos, lectura limitada de cuerpos, borradores Claude, asignación de campañas, exclusiones y mantenimiento.
- `lib/assistants/content`: publicación por fases persistidas, Graph con host fijo y carga de Reels al endpoint fijo de Meta.
- `lib/assistants/voice`: catálogo, creación de agente Claude, política de callbacks y reserva de llamadas.
- `lib/assistants/telegram`: Bot API y secreto de webhook; reutilización de cola e Inbox existentes.
- `components/assistants`: clientes, campañas, contenido, tareas, voz, Telegram y navegación adaptada al tamaño.

## Riesgos y decisiones explícitas

- No existe garantía técnica de vender o conseguir leads. La herramienta organiza, responde y permite medir resultados confirmados.
- No se modifican los precios actuales ni se copian tarifas de MyChatBot sin cálculo de margen. La voz y búsquedas requieren medir su consumo antes de ofrecer una tarifa comercial propia.
- Los registros JSON son estrictos en todas las rutas de escritura públicas. Para CRM de mayor volumen conviene separar entidades e índices analíticos; esta entrega limita cada sección a 500 registros y usa páginas de 100.
- El catálogo de campañas/voz muestra los primeros 100 clientes/campañas; para selección masiva, importación y segmentación avanzada hace falta otra interfaz. Los listados de cada sección permiten cargar más páginas.
- La cola de publicaciones utiliza operaciones externas por fase. Un proceso caído después del envío queda pendiente de reconciliación; esto sacrifica reintento automático para evitar publicaciones duplicadas.
- Una pausa no recupera una solicitud ya enviada. El estado confirmado del proveedor tiene prioridad para la reconciliación.
- Cifrado de Telegram depende de la configuración social existente. El token no se muestra después de conectarse.
- Datos de llamadas y entrenamiento se transmiten a proveedores externos conforme a su finalidad; revisión de privacidad y autorización son necesarias antes de producción.
- Calendarios y evidencias de revisión los mantiene el administrador. No hay integración automática con DNCR o RNE.
- No se habilitan números, cuentas, pagos ni campañas reales durante la verificación automatizada.

## Alcance que queda abierto

El manual `assistant-growth-activation.md` contiene la matriz completa de capacidades y límites. Se distinguen de forma explícita las funciones pendientes: generación de imágenes/vídeo finales, Facebook Stories directas, CRM externos, automatizaciones por palabras clave/post, envíos masivos, rediscado, transferencias telefónicas en vivo, widget público de voz e Insights de alcance/conversión. No se representa una tarjeta de configuración como integración ya terminada.

Las cuentas y aprobaciones externas no pueden completarse sin el propietario. Antes de abrir funciones reales, ejecutar las pruebas de aceptación del manual con cada proveedor y conservar resultados.
