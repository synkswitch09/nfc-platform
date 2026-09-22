# FAQs de NFC e impresión 3D — propuesta editorial para la página existente

Estado: BORRADOR PARA IMPLEMENTACIÓN FUTURA. No cargado en DB ni publicado.

Ampliación REC-035 / bloque H del plan v2. El sitio dispone de /faq, que combina preguntas generales con FAQs de categorías publicadas. Reutilizar ese flujo y sus acordeones. Estas respuestas se proponen en inglés australiano para el storefront actual; notas de revisión en español. No sustituyen contenido administrado por Daniel sin comparar primero el dataset real.

## Reglas de incorporación

- Leer preguntas existentes desde la tienda destino antes de insertar. Actualizar sólo con revisión de diferencias; conservar textos, IDs, orden, visibilidad y estilos existentes. No utilizar seed/reset para cargarlas.
- FAQs técnicas comunes: página general; FAQs específicas de mascota: categoría Pets, agregadas automáticamente a /faq. No copiar la misma pregunta a ambas fuentes.
- Agrupar visualmente por Getting started, Using your tag, Pet profiles and lost mode, Personalisation, Privacy, Orders and care. Mantener estructura FAQ actual y opciones de editar/ocultar/ordenar.
- Estado editorial PROPUESTA: respuesta sustentada por diseño/código conocido, sujeta a comprobación del flujo antes de publicar. CONFIRMAR: dato de hardware, condiciones comerciales o comportamiento pendiente; mantener oculto hasta validación. Estas etiquetas son del documento, no texto público ni obligación de crear un nuevo sistema de estados.
- No mostrar estas FAQs en tiendas sin producto NFC. Selección por relevancia del producto, no por añadir todas las preguntas a todas las marcas.

## Preguntas y respuestas propuestas

### Getting started — generales NFC

**01. What is a Tapkin smart tag?**
A Tapkin smart tag connects a physical tag to an online profile. Someone who finds it can open that profile using the tag’s NFC link or printed QR code and see the information you have chosen to share.

**02. What is the difference between NFC and a QR code?**
NFC opens a link when a compatible phone is held close to the tag. A QR code is scanned with a phone camera or QR reader. On a Tapkin tag, both methods are designed to open the same profile.

**03. Does the person who finds the tag need a Tapkin app?**
No dedicated Tapkin app is needed to view the public profile. The finder opens the link in their phone’s web browser.

**04. Does a smart tag have GPS or live tracking?**
No. A Tapkin tag is not a GPS tracker and does not show your pet’s live location. Any location shared through the profile depends on a visitor choosing to share it.

**05. Does the phone need internet access?**
Yes. The profile is a web page, so the phone needs an internet connection to load the current information.

**06. How do I activate my tag?**
Open the activation page using the instructions supplied with your tag, sign in or create your account, and enter the activation details when prompted. Once the tag is linked to your account, complete the profile and check what a visitor can see.

**07. Is the activation code the same as the QR code?**
No. The public QR code opens the tag’s link. The activation code is used to claim ownership of the tag. Keep your activation code private.

**08. Do I need an account to manage the profile?**
Yes. Your account lets you manage the profiles of tags you own. Visitors do not need to sign in to view a public profile.

### Using your tag — generales NFC

**09. How do I open the tag with NFC?**
Hold a compatible phone close to the tag and open the link notification when it appears. The reader position and phone settings vary by device. If NFC does not respond, try the printed QR code.

**10. What can I do if the tag will not scan?**
Try the QR code, check your internet connection and try another compatible phone. If the link opens but the profile is unavailable, check the tag’s activation and visibility settings in your account. Contact support if the problem continues.

**11. Can I change the information after activation?**
Yes. You can edit the profile information through your account without replacing the physical tag. Remember to save your changes and check the public profile afterwards.

**12. Does updating the profile change the tag’s link?**
Editing profile information does not require a new tag link. The existing NFC link and QR code continue to point to the profile associated with that tag.

**13. Can I manage more than one tag?**
Yes. Your account can contain multiple tags. Open the relevant tag in My Products to manage its individual profile.

**14. What happens before the tag is activated?**
An unclaimed tag does not display a completed pet profile. Its public link shows an activation message until the tag is claimed and its profile is set up.

### Pet profiles and lost mode — categoría Pets

**15. What information can I add to my pet’s profile?**
You can add a photo and information such as your pet’s name, species, breed, description, care notes and contact details. Review the profile before sharing it and only include information you are comfortable making public.

**16. Can I upload a photo of my pet?**
Yes. You can upload a pet photo from the profile editor in My Products. Use a clear photo that helps someone recognise your pet, and check the preview after saving.

Nota interna: verificar subida/lectura y REC-009 en runtime antes de publicar esta respuesta como capacidad comprobada.

**17. How do I mark my pet as lost?**
Sign in, open My Products, select your pet’s tag and use the Lost mode card to report your pet as lost. Check the public profile to confirm that the lost message is displayed.

**18. What does someone see when they find my pet?**
When the profile is public and available, the finder can see your pet’s profile and the contact options you have provided. If Lost mode is enabled, the page also displays a lost-pet notice.

**19. Will a scan automatically send me the finder’s location?**
No. Scanning the tag does not automatically give you the finder’s location. Location sharing requires the visitor’s choice and the device permissions needed for that action.

**20. Can the finder contact me without signing in?**
Yes. A public pet profile provides contact actions based on the details you have added. The finder can use those actions without creating a Tapkin account.

**21. How do I turn Lost mode off when my pet is home?**
Open the same tag in My Products and use the Lost mode controls to mark your pet as found. Then check that the public profile no longer shows the lost notice.

Nota interna: comprobar texto exacto y transición del control en UI antes de publicación; no asumir que “found” es el label exacto actual.

**22. Is a smart tag a replacement for a microchip?**
A Tapkin tag provides an accessible online profile and contact information. It does not replace an implanted microchip or any identification requirements that apply to your pet.

Nota interna: tratar como explicación del producto, sin afirmar requisitos legales específicos; revisar si se añade información local sobre registro.

### Personalisation — categoría Pets

**23. What is the difference between a basic and a personalised tag?**
Personalisation refers to the custom details offered for the physical product, such as a pet’s name. Available options depend on the product you choose. The online profile is managed separately from physical personalisation.

**24. Do I need a personalised tag to use NFC?**
NFC and personalisation are separate features. Check the product description to see whether NFC is included and whether personalisation is optional or required for that product.

**25. Can I choose the colour, size or shape?**
Choose from the options available on the product page. Available combinations and stock depend on the selected variant, so check your selection before adding it to your cart.

**26. Can I change the name printed on the tag through my account?**
Editing the online profile changes the digital information only. It does not change text already printed on the physical tag. Contact support if you need a different physical product.

### Privacy and access — generales NFC

**27. Who can see the information on the profile?**
A public profile is intended to be viewed by people who open its link, including someone who scans the tag. Treat the information you publish there as public, and avoid adding unnecessary sensitive details.

**28. Is my account password shown on the profile?**
No. Account sign-in details are separate from the public profile. Never put your password or activation code into the profile’s public text fields.

**29. What should I do if my contact details change?**
Update the contact information in the tag’s profile, save it and check the public page. Keeping these details current helps a finder reach the right person.

**30. What should I do if my tag is damaged or missing?**
Contact support with your order details or public tag ID so the available options can be reviewed. Do not send your password or activation code in a public message.

## Preguntas que requieren información antes de redactar una respuesta definitiva

Estas preguntas forman parte del alcance; no se publican con respuestas inventadas. La respuesta comercial debe aprobarse y coincidir con producto, checkout y políticas.

| Pregunta pública | Respuesta propuesta / información necesaria | Motivo de espera |
|---|---|---|
| Does it work with my iPhone or Android phone? | “You can open the profile through NFC on supported phones or by scanning the QR code.” Completar con modelos/ajustes comprobados del tag real. | Ensayo hardware; no prometer todos los teléfonos |
| Does the tag need batteries or charging? | Confirmar el chip pasivo que llevará el SKU antes de afirmar que no necesita batería. | Especificación del producto físico |
| Is it waterproof? | Indicar sólo resistencia y cuidados comprobados; no usar waterproof sin pruebas. | Material, encapsulado y ensayo |
| What is the tag made from? | Identificar material real de cada variante; no asumir PLA/PETG. | Catálogo/hardware |
| What sizes and weights are available? | Mostrar medidas y peso reales por variante. | Medición del producto |
| Is it suitable for cats and small dogs? | Orientar según peso, dimensiones y sistema de sujeción reales. | Ensayo y producto, no garantía general |
| How should I clean and care for it? | Instrucciones aprobadas según material y fijación. | Validación de cuidados |
| Is there a subscription or ongoing fee? | Confirmar precio del perfil y condiciones de mantenimiento; no prometer gratis de por vida. | Política comercial |
| Can the NFC chip be rewritten? | Confirmar tipo de chip y bloqueo; edición del perfil no implica reescribir el chip. | Seguridad/configuración hardware |
| Can I transfer a tag to another owner? | No prometer autoservicio hasta implementar/verificar transferencia y requisitos de propiedad. | Flujo no confirmado |
| Will I receive a notification every time someone scans it? | Diferenciar registro interno de escaneos de avisos al propietario. | Entrega de notificaciones no confirmada |
| Can I make the entire profile, including its photo, private? | Redactar sólo después de corregir y probar acceso directo/caché de fotos. | REC-009 |
| How long does making and shipping my order take? | Separar fabricación y tránsito, con plazos reales. | Operación y transportista |
| How much does delivery cost, and where do you ship? | Referir al cálculo/configuración real del checkout y zonas activas. | Verificación tarifas/destinos |
| Can I return a personalised tag or change my order? | Enlazar política aprobada y canal de soporte; no inventar exclusiones de derechos del consumidor. | Condiciones comerciales/legales |
| What happens if the website is temporarily unavailable? | Explicar que el perfil web requiere servicio disponible; añadir soporte y medidas operativas comprobadas, sin SLA inventado. | Política de continuidad |

## Aceptación del bloque FAQ

1. Inventario/diff de preguntas reales revisado; ninguna edición previa de Daniel borrada.
2. Preguntas comunes guardadas una sola vez; Pets mantiene sus preguntas y /faq las reúne sin duplicaciones introducidas por esta carga.
3. Acordeones accesibles por teclado y en móvil; contenido legible en HTML para usuarios y crawlers.
4. Edición, orden y visibilidad persisten al guardar/recargar; preguntas ocultas no aparecen en ninguna agregación pública.
5. Enlaces a producto, My Products, activación, soporte y políticas usan rutas reales de esa tienda.
6. Sólo respuestas verificadas pasan a visibles; las pendientes permanecen en borrador documental o módulos ocultos, sin notas internas en la web.
7. En-AU inicialmente; traducciones con el sistema existente cuando se habiliten, sin fingir cobertura.
8. Carga controlada e idempotente después de aprobar implementación: repetir no duplica ni sobrescribe cambios posteriores del admin. Sin seed/reset y sin propagación a otros Sites.

Fuentes del proyecto: app/faq/page.tsx, lib/category-content.ts, lib/landing-sections.ts, app/t/[publicTagId]/page.tsx, app/dashboard/tags/[tagId]/page.tsx y hallazgos de la auditoría. Estos textos son una propuesta editorial, no evidencia de que se hayan completado las pruebas runtime pendientes.

## Ampliación de alcance solicitada: NFC e impresión 3D

Esta aclaración sustituye el enfoque limitado a tags Pets. La página /faq existente cubrirá información general útil sobre NFC e impresión 3D, junto con preguntas de productos y servicios realmente ofrecidos. No se crearán páginas duplicadas ni una enciclopedia indiscriminada. Las 30 respuestas anteriores se conservan como parte del conjunto; se añadirán las siguientes propuestas y se revisarán sus posibles solapamientos.

Organización propuesta del contenido: NFC básico; compatibilidad y uso; perfiles y privacidad; impresión 3D básica; materiales y cuidados; archivos/diseño/presupuestos; personalización y variantes; pedidos y entrega; preguntas específicas de Pets. Son grupos editoriales usando módulos FAQ existentes, no nuevos tipos de sección. Cada Site muestra sólo los grupos pertinentes: una tienda sin NFC no heredará sus preguntas automáticamente.

### NFC general — respuestas adicionales propuestas

**31. What can NFC be used for besides pet tags?**
NFC can connect a physical item to digital information, such as a contact page, business profile or useful web link. The features available depend on the product and service. Check the individual product description for what is included.

**32. Are NFC, QR codes and GPS the same thing?**
No. NFC and QR codes can provide ways to open a link. GPS is a different technology used for positioning. Adding an NFC chip or QR code to a product does not make it a live location tracker.

**33. Is an NFC tag the same as a contactless payment card?**
No. A Tapkin profile tag is intended to open its associated information, not to function as your bank card or payment wallet.

**34. Does every 3D-printed product include NFC?**
No. NFC is an optional feature of specific products. An item can be 3D printed without containing an NFC chip, QR code or online profile.

**35. Does every NFC product need to be personalised?**
No. NFC functionality and physical personalisation are separate. A product may offer NFC without custom printed text, and a personalised item may have no NFC feature at all.

**36. Can I link a tag to any website I choose?**
The available destination options depend on the product. A Tapkin pet tag opens its pet profile. Other products may offer different profile or link options; check what the specific product supports before ordering.

**37. Is changing the online information the same as rewriting the NFC chip?**
No. Updating a hosted profile changes the information at its web address. Rewriting a chip changes data stored on the chip itself and depends on its configuration. Do not assume a purchased tag is rewritable.

**38. Can someone edit my profile just by scanning the tag?**
Scanning opens the public view, not the account editor. Managing the profile requires authorised account access. Keep your password and activation details private.

Nota interna: estas explicaciones no habilitan ni anuncian nuevos productos business/social; mostrar ejemplos como usos generales, no como oferta disponible.

### Impresión 3D — respuestas generales propuestas

**39. What is 3D printing?**
3D printing is a manufacturing process that builds a physical object from a digital model in successive layers. The process, material and finishing choices affect the final result.

**40. What is the difference between a ready-made design and a custom design?**
A ready-made design already defines the product’s shape. Custom design involves creating or changing that shape to meet a particular need. Design work and printing are different parts of a project, so a quote should make clear which are included.

**41. Will a 3D-printed item have visible layer lines?**
It can. Surface appearance depends on the design, printing process and finishing. Check actual product photos and the description for the finish you can expect rather than assuming every surface will be perfectly smooth.

**42. What affects the price of a 3D-printed item?**
Factors can include the size and design, material, production time, number of colours, finishing, quantity and any design work. For a custom job, the requirements need to be reviewed before a reliable price can be given.

**43. Why can two similarly sized prints have different prices?**
Size alone does not describe all the work involved. Different shapes, details, materials, colour changes and finishing requirements can lead to different production costs.

**44. What is the difference between colour, size, shape and personalisation?**
Colour, size and shape describe the version of a product you choose. Personalisation adds individual details, such as a name or message. Only the options listed for the selected product are available for that order.

**45. Will the colour look exactly the same as it does on my screen?**
Screen settings and lighting can change how a colour appears. Use the product’s colour names and photos as a guide, and contact support before ordering if an exact colour match is important.

**46. How do I choose the right material?**
Start with how and where the item will be used, including the expected loads, heat, moisture and finish. Use the product’s stated material and care guidance. Do not assume different printing materials are interchangeable for every use.

**47. Can a 3D-printed item be used outdoors or in a hot car?**
Suitability depends on the specific material, design and conditions. Only use an item in those environments if its product guidance says it is suitable. Do not treat all 3D-printed products as heat-resistant or weatherproof.

**48. Can I order several copies of the same item?**
For catalogue products, select the quantity available on the product page. Contact support about larger quantities or special requirements rather than assuming the same production time or a bulk discount applies.

**49. Can a 3D-printed product contain an NFC chip or QR code?**
Yes, a product can be designed to include those features. They are not included in every printed item, so check the description of the product you are buying.

**50. What information is useful when asking about a custom print?**
Describe the item’s purpose, approximate dimensions, quantity, preferred appearance and any important fit or use requirements. If you already have a design, mention its file format and whether you have permission to use it. The available service and submission method must be confirmed before sending files.

### Preguntas adicionales por investigar y completar antes de publicar

No sustituir datos desconocidos por promesas. Añadir respuestas después de revisión técnica/documental y confirmación de servicios. Conservar estas preguntas en el plan aunque todavía no sean visibles en la web.

| Grupo | Preguntas | Requisito para responder/publicar |
|---|---|---|
| NFC y teléfonos | Where is the NFC reader on my phone? Does NFC work with a case? Do I need to enable NFC? | Documentación vigente del dispositivo y prueba del producto; evitar instrucciones universales |
| NFC físico | What is the reading distance? Can it be used on metal? How long does the chip last? | Chip, antena, montaje y ensayos reales; sin vida útil garantizada inventada |
| Seguridad NFC | Can a tag be copied? Can I lock or reuse it? | Configuración y modelo de amenaza; no afirmar que NFC es imposible de copiar |
| Procesos | What is the difference between filament and resin printing? Which process do you offer? | Información técnica revisada y proceso realmente ofrecido, sin anunciar resina si no existe |
| Materiales | PLA vs PETG: which should I choose? Which materials and finishes are available? | Catálogo real y especificaciones del fabricante; explicar elección según uso |
| Archivos | Can I send my own STL? Do you accept 3MF, STEP or OBJ? | Formatos y canal seguro realmente habilitados; no prometer upload por existir una FAQ |
| Diseño | Can you print from a photo or sketch? Can you repair or resize my model? | Alcance, capacidad, precio y proceso de aprobación del servicio |
| Dimensiones | What is the maximum print size? How accurate will the dimensions be? | Equipo/proceso/tolerancias probados, sin tolerancia universal |
| Colores | Can you print multiple colours? Can you match a brand colour? | Opciones ofrecidas y límites reales; no garantizar correspondencia exacta |
| Cuidados | How do I clean it? Is it dishwasher-safe? Can it get wet? | Material y diseño concreto; instrucciones verificadas |
| Usos sensibles | Is it suitable for food contact, children or load-bearing use? | Evidencia específica y revisión aplicable; no promesas genéricas de seguridad |
| Derechos de diseño | Can you print a design I downloaded online? Can you print branded characters? | Política de revisión de licencia/permisos y documentación; descargar no demuestra autorización |
| Presupuestos | Is design work included? Is there a minimum order? Do you offer samples? | Condiciones comerciales aprobadas |
| Producción | How long will a custom job take? Can I approve a proof? Can I change a file after ordering? | Flujo real de cotización/aprobación/fabricación |
| Servicio local | Do you offer Adelaide collection or delivery? Can you ship elsewhere in Australia? | Modalidades/destinos activos y ubicación pública autorizada |

### Criterios adicionales de aceptación

- Las FAQs explican NFC e impresión 3D por separado y cómo pueden combinarse, sin hacer obligatorio NFC para productos normales.
- La página existente conserva las FAQs generales y de categorías; búsqueda de duplicados por significado antes de cargar nuevos grupos.
- Ninguna pregunta anuncia materiales, formatos, servicios, certificaciones, recogida local o capacidades que aún no se ofrecen.
- Preguntas generales pueden publicarse cuando su respuesta esté revisada; condiciones de Tapkin deben coincidir con catálogo, checkout, políticas y operación.
- La tabla de temas pendientes se convierte en respuestas sólo al disponer de evidencia. No se publica texto interno del tipo “por confirmar”.
- Alcance suficiente para dudas reales de compra y uso, sin producir cientos de preguntas de relleno ni crear un sistema FAQ nuevo.
