# Protección de credenciales y sesión

## Cambios en el código local

- next.config.ts no define una propiedad env ni inyecta DATABASE_URL en los bundles.
- .env.example y el archivo local ignorado .env.production ya no definen NEXT_PUBLIC_DATABASE_URL. La conexión permanece en DATABASE_URL del lado servidor.
- src/lib/prisma.ts y src/lib/auth-options.ts importan server-only para bloquear su uso accidental desde componentes cliente.
- En producción, NextAuth falla al inicializar si falta NEXTAUTH_SECRET, si tiene menos de 32 caracteres o si coincide con un marcador de ejemplo conocido. No hay un secreto predeterminado codificado en el proyecto.
- Las sesiones JWT vencen a los siete días. NextAuth conserva sus valores predeterminados de cookie HttpOnly y SameSite=Lax; useSecureCookies exige cookies Secure en producción.
- En cada callback JWT se vuelve a consultar el usuario en la base de datos para actualizar email, nombre e isAdmin. Si se elimina el usuario, se borran del token los datos de identidad.
- Los errores del inicio de sesión con credenciales ya no distinguen entre usuario inexistente y contraseña incorrecta.

## Comprobaciones locales

- Se buscaron los valores actuales de DATABASE_URL en los 89 commits disponibles: no aparecen en el historial versionado.
- Se revisaron 71 archivos generados bajo .next y los 16 bundles JavaScript enlazados desde la página pública del alias actual de Vercel; no apareció una coincidencia exacta con las URL locales actuales. Esto no cubre source maps, previews ni deploys históricos.
- GET /api/auth/session local responde HTTP 200 y JSON válido.
- El test de seguridad src/lib/auth/session-security.test.ts comprueba la política del secreto, expiración de sesión, actualización de permisos y ausencia de configuración pública para la base de datos.

## Riesgo histórico y pasos para el despliegue

En versiones anteriores de next.config.ts del historial de Git sí existía la configuración env con DATABASE_URL igual a process.env.DATABASE_URL. Esa configuración era insegura porque Next.js puede incrustar esas variables en JavaScript. La versión actual ya no lo hace, pero una corrección local no elimina bundles de deploys anteriores.

No se puede confirmar desde este repositorio si una versión histórica con esa configuración llegó a producción. Antes de lanzar, revisá los deploys de producción y preview en Vercel. **Si alguno fue construido con esa configuración (o no podés descartarlo), rotá la contraseña/credencial de la base en Aiven**, actualizá DATABASE_URL en las variables de entorno de Vercel y en los archivos locales que uses, volvé a desplegar y eliminá los deploys antiguos. No pegues secretos en tickets o chats.

En Vercel, verificá también que DATABASE_URL y NEXTAUTH_SECRET estén configuradas en el entorno de Production, que NEXT_PUBLIC_DATABASE_URL no exista y que el deploy publicado incluya el código corregido. Cambiar NEXTAUTH_SECRET invalida las sesiones existentes; no hace falta rotarlo solo por esta corrección si no estuvo expuesto, pero sí si sospechás que se divulgó.

## Endpoints administrativos y CORS

- Se eliminó el código de src/app/api/seed/route.ts. Ya no existe una ruta HTTP que borre el catálogo y cargue productos de muestra. Si necesitás sembrar datos, hacelo mediante un comando/manual de desarrollo, nunca exponiendo un endpoint destructivo.
- GET /api/aiven-status es solo de lectura y POST es el único método que puede solicitar el encendido. Ambos requieren una cookie de sesión NextAuth válida con la marca firmada isPlatformOwner=true. Esa marca la actualiza el callback JWT desde la base de datos; la ruta lee el JWT firmado directamente para poder funcionar cuando Aiven está apagado.
- La ruta Aiven devuelve solo estados genéricos y no responde con cuerpos de error del proveedor, causas internas, nombre de proyecto ni detalles de configuración. Las llamadas al proveedor tienen timeout. No se han hecho llamadas reales para encender/apagar Aiven en las pruebas.
- Se retiró el despertar automático de Aiven desde el SSR público de la página inicial. DatabaseGuard solo consulta/solicita despertar cuando la sesión del propietario se valida; una visita anónima ya no puede activar el servicio. En consecuencia, el propietario debe tener sesión válida para despertarlo si está apagado.
- La política CORS es única y vive en src/proxy.ts + src/lib/security/cors.ts. Solo devuelve encabezados con credenciales para un origen HTTP(S) exacto incluido en la lista de permitidos; rechaza peticiones con Origin no autorizado antes de llegar al endpoint. Se ignoran comodines, rutas, credenciales embebidas y esquemas que no sean HTTP(S).
- next.config.ts no añade encabezados CORS. allowedDevOrigins solo configura hosts para el servidor de desarrollo de Next.js; no es la lista de acceso CORS.
- Si una aplicación web legítima llama a esta API desde otro origen en producción, configurá CORS_ALLOWED_ORIGINS con los dominios exactos separados por comas. Los dominios de NEXTAUTH_URL, NEXT_PUBLIC_SITE_URL y NEXT_PUBLIC_APP_URL también son orígenes explícitos permitidos. No copies dominios localhost a Production.
- Hay pruebas Vitest repetibles para el control CORS, la ausencia de /api/seed, el control de acceso a Aiven, y la no divulgación de errores de proveedor.

## Endurecimiento de checkout, pagos y sesiones (2026-10-21)

### Cambios locales aplicados

- El servidor resuelve la identidad mediante una sesión NextAuth firmada o un bearer token firmado. Las rutas de checkout, historial, cuenta, reseñas, cancelación y pagos ya no necesitan confiar en `userId` o email enviados en el JSON ni en las cabeceras `x-user-id` / `x-user-email`.
- La app móvil guarda el bearer token en `expo-secure-store`; no lo almacena en AsyncStorage. El JWT de la app móvil no lleva permisos administrativos; las rutas restringidas deben comprobar los permisos actuales en el servidor.
- `POST /api/orders` está deshabilitado con HTTP 410 porque era una vía antigua para crear órdenes como `PAID` sin una comprobación fiable del pago. También se retiró la mutación GraphQL `checkout` y se deshabilitó su servicio de creación directa. El flujo normal debe reservar stock y confirmar mediante la pasarela.
- Checkout valida la forma y tamaño de los datos de entrada, acota líneas y cantidades, deriva precio/stock del catálogo en la base de datos y no devuelve al cliente cuerpos crudos de errores internos.
- La confirmación de Mercado Pago verifica el pago desde la API del proveedor, la propiedad de la reserva, estado acreditado, referencia, importe, moneda y vencimiento. El cambio a `PAID` se hace mediante una actualización condicional para evitar confirmaciones simultáneas duplicadas.
- La confirmación de Stripe verifica el PaymentIntent recuperado del proveedor, la reserva del usuario, metadata, importe, moneda y estado `succeeded`. La captura de PayPal vuelve a consultar la orden remota y coteja referencia, importe y moneda antes de capturar; un importe capturado discrepante queda en `PAYMENT_REVIEW`.
- Carrito y favoritos GraphQL derivan el propietario desde la sesión y aplican límites/validación al contenido; no crean usuarios ficticios a partir de un ID arbitrario.
- Registro, login móvil, checkout, proceso de pago, confirmaciones, cuenta, reseñas, cancelaciones y GraphQL incorporan validaciones o limitación de solicitudes. El webhook de Mercado Pago valida `x-signature` con HMAC, falla de forma cerrada si falta la clave y consulta la API oficial antes de modificar órdenes. Soporta los tópicos `order` (Orders API) y `payment` (Payments API), coteja referencia externa, ID del recurso, estado, importe y moneda, y actualiza pedidos con cambios atómicos e idempotentes. Puede confirmar un pago aprobado, devolver al estado de pago fallido y restaurar stock solo ante un fallo terminal verificado, registrar reembolso/contracargo o dejar discrepancias/vencimientos en `PAYMENT_REVIEW`. Los casos de revisión envían una alerta por Telegram cuando la integración está configurada.
- El checkout web principal ahora usa `MercadoPagoCardForm` con los campos sensibles alojados por CardForm en iframe; se eliminaron el formulario HTML antiguo de tarjeta y sus helpers sin uso. Las ayudas de autocompletado/datos de tarjeta de prueba de Mercado Pago, Stripe y PayPal sólo aparecen en desarrollo.
- En la app móvil, el checkout de Mercado Pago dejó de recopilar número, vencimiento y CVV en campos nativos: crea una orden por `/api/checkout` y abre la URL HTTPS validada del checkout alojado por Mercado Pago. La URL de API móvil debe ser HTTPS fuera de desarrollo. El correo de payer de Mercado Pago se toma del usuario autenticado en lugar de un email de prueba hardcodeado.
- Se añadieron modos explícitos de pagos. En desarrollo, Mercado Pago/Stripe/PayPal usan sandbox; en un proceso de producción los modos faltantes no habilitan pruebas por defecto. Mercado Pago bloquea el cobro en `production`/modo desconocido, sólo admite tokens OAuth cuya metadata almacenada identifique sandbox o una credencial configurada expresamente como `STORE_MERCADOPAGO_SANDBOX_ACCESS_TOKEN`, y no usa el token genérico `STORE_MERCADOPAGO_ACCESS_TOKEN` como fallback. La clave pública standalone requiere `NEXT_PUBLIC_STORE_MERCADOPAGO_SANDBOX_PUBLIC_KEY`. Stripe sólo acepta un modo sandbox explícito y una clave `sk_test_`; PayPal sólo devuelve credenciales cuando el modo sandbox se habilita expresamente. El flujo live de los tres proveedores no está habilitado todavía.
- Se añadieron pruebas para compatibilidad del bearer/cookie con NextAuth v4, firma del webhook y selección segura del entorno/credenciales de Mercado Pago.

### Verificación local

- `npm run check:types`: aprobado después de los cambios de checkout y modos de proveedor.
- `npm test`: **129 pruebas aprobadas en 30 archivos** (incluye 8 pruebas nuevas sobre la selección segura del entorno de Mercado Pago).
- Suite focalizada de webhook: **12 pruebas aprobadas en 2 archivos**, incluyendo firma válida/inválida, Orders API, Payments API, token del proveedor rechazado, simulación con recurso inexistente, discrepancia de importe y fallo terminal con restauración de stock.
- `cd ecommerce-mobile && npx tsc --noEmit`: aprobado tras eliminar los campos de tarjeta nativos y ocultar Stripe móvil.
- `npm run build`: compilación de producción final aprobada localmente.
- `git diff --check`: sin errores de whitespace.
- Estas comprobaciones son locales: no equivalen a una prueba de penetración ni a una prueba integral de las pasarelas, y no verifican que Vercel ya esté desplegado con los cambios.

### Pendientes antes de producción

- **Configuración en Vercel:** agregar de forma privada `MERCADOPAGO_WEBHOOK_SECRET` y un valor explícito para `MERCADOPAGO_ENVIRONMENT`. La variable guardada en el `.env` local no se copia automáticamente a Vercel. No habilitar cobros live todavía.
- **Pagos live (los tres proveedores):** Mercado Pago requiere OAuth live para marketplace, reparto 90/10, webhooks live y reconciliación; Stripe sigue limitado a Connect de pruebas y PayPal al Partner sandbox. Implementar y validar esas variantes live antes de aceptar pagos reales. Cambiar una variable a `production` actualmente deshabilita los cobros; no habilita un modo live funcional.
- **Prueba del checkout alojado:** probar el flujo móvil de Mercado Pago en sandbox en iOS, Android y Expo Web; la URL de API móvil debe ser HTTPS en builds que no sean de desarrollo. El botón de Stripe móvil quedó oculto porque todavía falta una integración nativa segura del PaymentIntent; debe implementarse y probarse antes de volver a habilitarlo.
- **PCI:** CardForm con iframe evita que los campos web de número, vencimiento y CVV sean inputs HTML controlados por nuestra app, pero la elegibilidad final de SAQ A depende de los criterios completos. Confirmar con Mercado Pago/el adquirente qué autoevaluación corresponde a la integración final.
- **Limitación de solicitudes:** el rate limit actual usa memoria por proceso y puede no compartirse ni persistir en Vercel/serverless. Añadir protección compartida en edge/WAF o un almacén distribuido antes de confiar en esos límites en producción.
- **Historial de despliegues:** revisar los despliegues antiguos de Vercel y el posible riesgo histórico de credenciales de base de datos según la sección anterior. Los cambios locales no modifican automáticamente bundles ya publicados.
- **Pruebas reales del proveedor:** no se hicieron cargos reales, capturas ni reembolsos. Completar pruebas controladas de sandbox con el túnel activo (ngrok no respondió en la última comprobación). El alias de Vercel sí respondió por HTTPS, redirigió HTTP a HTTPS y presentó HSTS al verificarlo desde la máquina local.

## Guardado de tarjetas Mercado Pago (sandbox)

- Fecha: 2026-10-22.
- El checkout web muestra directamente el formulario nuevo cuando el usuario no tiene tarjetas guardadas. Si tiene alguna, ofrece primero sus tarjetas en un carrusel horizontal y deja «Agregar nueva tarjeta» como última opción.
- Guardar es opt-in explícito. La primera tokenización se utiliza para asociar la tarjeta al cliente de Mercado Pago; luego se solicita el CVV de nuevo para autorizar el pago inicial. En compras siguientes se muestra la tarjeta enmascarada y Mercado Pago vuelve a tokenizar el CVV con Secure Fields.
- Las tarjetas se asocian a un `PaymentCustomer` local propiedad del usuario autenticado y aislado por proveedor/cuenta conectada. `SavedPaymentMethod` guarda el ID externo de la tarjeta, el medio de pago, marca/nombre, últimos cuatro dígitos y vencimiento. No se persisten PAN completo, CVV ni tokens de tarjeta.
- `GET`, `POST` y `DELETE /api/payment-methods/mercadopago` exigen sesión autenticada; el acceso de lectura/escritura es privado y sin caché. El servidor comprueba propiedad de usuario y ámbito de cuenta para usar o eliminar cada tarjeta. La ruta está limitada a sandbox; los entornos no sandbox se rechazan.
- `POST /api/process-payment` vuelve a comprobar que la referencia local pertenece al usuario autenticado y a la misma cuenta del proveedor. La implementación utiliza `payer.customer_id` con Orders API y `payer.type=customer`/`payer.id` con Payments API cuando el cobro usa split.
- Migración aditiva `20261022080000_saved_payment_methods` aplicada mediante `prisma migrate deploy` a la base configurada en el entorno de desarrollo. No modifica las órdenes existentes.
- La suite automatizada cubre el guardado con datos del proveedor simulados, los estados de UI, el ámbito de cuenta, el uso de `customer_id`, el token del CVV y el bloqueo fuera de sandbox. No se hizo una transacción real ni una prueba integral contra la API de Mercado Pago; queda pendiente probar en sandbox cuando se retome el diagnóstico de la transacción.

## Guardado de tarjetas Stripe (sandbox, 2026-10-22)

- El checkout web puede mostrar tarjetas guardadas en un carrusel horizontal, seleccionar una tarjeta ya guardada o cambiar a «Agregar nueva tarjeta». Si no existen tarjetas, el formulario de tarjeta aparece directamente.
- El guardado de una tarjeta nueva es voluntario mediante una casilla opcional. El servidor solo configura `setup_future_usage=on_session` cuando el usuario lo marca; la confirmación del PaymentIntent permite que Stripe asocie el método al Customer. El usuario puede quitar una tarjeta y el servidor la desvincula con `PaymentMethod.detach`.
- La tarjeta queda custodiada por Stripe. La base de datos propia conserva únicamente el ID de Stripe, marca/últimos cuatro dígitos/vencimiento y la relación con un `PaymentCustomer` propiedad del usuario. No se almacenan PAN completo, CVC/CVV, claves secretas ni tokens de confirmación de tarjeta.
- `POST /api/stripe/prepare` exige sesión, usuario y reserva coincidentes, comprueba el PaymentIntent remoto, metadata, importe, moneda, vencimiento y estado, y valida que una tarjeta guardada esté vinculada al Customer del usuario en la misma cuenta sandbox. La creación de Customer usa metadata de propietario e idempotencia.
- `GET` y `DELETE /api/payment-methods/stripe` son privados, no cacheables y limitados por usuario. Las tarjetas se consultan/sincronizan desde Stripe antes de mostrarse; eliminar una tarjeta verifica primero la asociación remota. La ruta requiere Stripe Connect sandbox operativo y rechaza cualquier configuración que no use `sk_test_`.
- La confirmación de orden sincroniza los métodos guardados después de confirmar `PaymentIntent.status=succeeded`, pero un fallo al sincronizar la tarjeta no bloquea el registro de una compra ya pagada.
- Las pruebas usan mocks de Stripe y no se ejecutaron cargos reales ni una compra end-to-end contra la API de Stripe. La migración genérica `20261022080000_saved_payment_methods` ya estaba aplicada durante el trabajo previo de Mercado Pago y se reutiliza; esta tarea no añade columnas ni migraciones.

## Guardado de tarjetas PayPal Vault (sandbox, 2026-10-22)

- El checkout web ofrece el mismo patrón visual que Mercado Pago y Stripe: si no hay tarjetas guardadas muestra los campos existentes; si sí hay, muestra un carrusel horizontal de tarjetas enmascaradas, «Agregar nueva tarjeta» y una acción para eliminarlas.
- Guardar requiere marcar expresamente «Guardar esta tarjeta para futuras compras». La orden Orders API incluye los atributos de Vault solo cuando se marca esa casilla; una tarjeta existente se indica mediante su Vault ID. La comisión Connect actual se mantiene en el purchase unit.
- Se agregó `GET`/`DELETE /api/payment-methods/paypal`, con sesión autenticada, rate limit, `Cache-Control: private, no-store`, ámbito aislado por comercio, y comprobación del propietario local antes de consultar o eliminar el token remoto. La lista se sincroniza contra PayPal Vault; una respuesta vacía no purga en forma agresiva los datos locales debido a la propagación asíncrona de Vault. Si PayPal rechaza el guardado por falta de elegibilidad, el error presentado al usuario permite desmarcar la casilla y probar el pago normal.
- Después de que PayPal confirma una captura completada, la ruta intenta guardar el Vault customer y, si la respuesta ya contiene el token, la referencia del método y sus datos enmascarados. Si PayPal tarda en publicar el token, el customer se conserva para que el siguiente GET pueda reconciliar. Los fallos al sincronizar metadatos de la tarjeta no revierten una compra que ya quedó pagada.
- El checkout verifica la propiedad local del Vault ID y consulta el token remoto para confirmar que sigue asignado al customer correcto antes de crear otra orden. La captura vuelve a validar usuario, reserva, estado, referencia del proveedor, importe, moneda y token elegido. Si PayPal devuelve una orden ya `COMPLETED`, se reutiliza la captura comprobada y no se envía una segunda solicitud de captura.
- La base propia guarda solamente ID de token/customer del proveedor, marca, últimos cuatro dígitos y vencimiento. No almacena PAN completo ni CVV/CVC. No fue necesaria una migración nueva: se reutilizan las tablas de `20261022080000_saved_payment_methods`.
- **Elegibilidad externa pendiente:** la documentación de PayPal para guardar tarjetas mediante Vault/Expanded Checkout muestra una lista de países admitidos que no incluye Argentina. También exige que la cuenta tenga habilitados Advanced/Expanded Checkout y Vault en la app sandbox. Esta implementación queda en sandbox y muestra un error controlado si PayPal rechaza esa capacidad; la lista local no demuestra que PayPal haya aprobado la cuenta. Comprobarlo en Developer Dashboard y durante la compra de prueba.
- No se hizo una compra real contra PayPal, no se validó la elegibilidad del Vault en la cuenta conectada del usuario y no se desplegó a Vercel. Los tests mockean el proveedor.
