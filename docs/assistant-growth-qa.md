# QA de la ampliación de asistentes

## Verificaciones realizadas

- La suite anterior completa: 136 archivos / 843 pruebas, aprobada antes de agregar las pruebas nuevas.
- Nuevas pruebas unitarias/HTTP: 44 casos de locales, países/zonas horarias, evidencia de ventas, consentimiento, exclusión, expiración, horarios locales, festivos, presupuesto desactivado, firmas HMAC alteradas/antiguas, proveedor sin configurar, URL host arbitrario, validación de publicación, límites de cuerpo, búsquedas Claude con fuentes, CSRF, autenticación, aislamiento, versiones y cuotas por sección.
- Revisión local final: **138 archivos / 887 pruebas aprobadas**, TypeScript aprobado y lint aprobado.
- Compilación y comprobación SQL de la revisión final: consultar la ejecución CI correspondiente al commit del PR; las cuentas externas siguen pendientes de prueba real.
- Navegador: vista real de los componentes con API simulada y datos sintéticos. Probados navegación, alta y guardado de cliente, presentación del estado sin permiso, selección de campaña, simulación privada, editor móvil de campaña y editor tablet de contenido.
- Tamaños observados: escritorio; iframe con viewport móvil 390 × 844 (ancho útil 375 por scrollbar); tablet 768 × 1024 (ancho útil 753). En formularios comprobados, `scrollWidth === clientWidth`: sin desbordamiento horizontal.
- Detectado y corregido: navegación horizontal poco cómoda en móvil, falta de scroll/foco hacia el editor y fallback de fuente cuando la variable de Inter no está disponible. El error de guardado simulado conserva el formulario y sus cambios; posteriormente se verificó guardado exitoso.
- Añadido `scripts/check-assistant-growth.ts` al pipeline: usa exclusivamente PostgreSQL descartable de CI, con todas las llamadas HTTP externas simuladas. Comprueba aislamiento de tenants, reserva por versión, doble publicación concurrente, cancelación por pausa, llamada única concurrente, reserva de cuota y cascada limitada al workspace eliminado.

## Pendiente de servicios reales

- OAuth y aprobación de permisos adicionales en Meta; publicar todos los formatos soportados con medios válidos reales.
- Callback de Telegram real y extremo a extremo con una cuenta de cliente.
- Elegibilidad de plan ElevenLabs, validación del payload de agente por API real, verificación del hablante, importación Twilio, reproducción de voces y cambio de idioma durante una llamada.
- Entrega del webhook de voz real, identificación/consentimiento en apertura y rechazo durante llamada.
- Límites de gasto de proveedores, ejecución del job de minuto y purga con datos reales de prueba.
- Auditoría de accesibilidad completa con lector de pantalla y WCAG; se revisaron etiquetas, foco, contraste básico, adaptación y movimiento reducido, no se certifica cumplimiento integral.
- Pruebas de carga y volumen fuera de las cuotas acotadas de esta entrega.

No se hicieron llamadas reales, compras de números, publicaciones públicas ni envíos comerciales durante QA. Una integración implementada no se considera activada ni verificada extremo a extremo hasta pasar las pruebas anteriores.
