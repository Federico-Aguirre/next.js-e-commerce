🌐 **Idioma:** **Español** | [English Version](README.md)

# 🛒 Nova Store - E-Commerce de Alta Performance

[![Ver Proyecto en Vivo](https://img.shields.io/badge/🚀_Ver_Proyecto_en_Vivo-007ACC?style=for-the-badge&logo=vercel&logoColor=white)](https://next-js-e-commerce-999.vercel.app)

¡Bienvenido a **Nova Store**! Una aplicación web de comercio electrónico moderna, rápida y escalable construida con arquitectura de vanguardia en Next.js. El proyecto simula una tienda de ropa exclusiva integrando flujos complejos de autenticación, persistencia de datos en la nube, pasarela de pagos y testing automatizado.

---

## 🚀 Stack Tecnológico & Arquitectura

Este proyecto fue diseñado bajo estándares de nivel producción, priorizando el desacoplamiento de componentes y la optimización del rendimiento:

- **Frontend:** `Next.js 15+ (App Router)` aprovechando la potencia de los **Server Components (RSC)** para cargas asíncronas inmediatas y SEO optimizado.
- **Estilos:** `Tailwind CSS` con un diseño minimalista, responsivo y animaciones fluidas (`ease-out`).
- **Base de Datos en la Nube:** `Aiven (PostgreSQL)` para garantizar persistencia robusta del historial de compras y perfiles de usuario.
- **API Layer:** `GraphQL` local mediante peticiones `fetch` nativas, optimizando la transferencia de datos y evitando el over-fetching.
- **Gestión de Estado Global:** `Zustand` para el manejo del carrito de compras en memoria, logrando actualizaciones en tiempo real sin re-renders innecesarios.
- **Autenticación:** `NextAuth.js` integrado de forma segura con Google OAuth y almacenamiento de sesiones en base de datos.
- **Pasarela de Pagos:** Flujos de checkout y webhook/estado de pedidos de Mercado Pago implementados para pruebas en sandbox. Los pagos en producción y la división de comisiones de marketplace siguen bloqueados hasta validar el OAuth del vendedor y el flujo completo de pago.

---

## ✨ Características Principales (Features)

1.  **Buscador Sincronizado en URL:** Filtrado instantáneo del catálogo mediante _Query Params_ (`?search=...`). Permite compartir enlaces con búsquedas ya pre-cargadas de forma orgánica.
2.  **Skeleton Loader Premium:** Implementación de pantallas de carga animadas (`animate-pulse`) dentro de bloques `<Suspense />` para mejorar la percepción de velocidad del usuario (UX).
3.  **Lista de Deseos (Wishlist):** Persistencia independiente de productos favoritos por usuario de manera reactiva.
4.  **Historial de Órdenes Dinámico:** Sección exclusiva ("Mis Compras") protegida por NextAuth que lee y mapea las órdenes procesadas desde Aiven de forma segura.

---

## Servicios ofrecidos, funcionalidades actuales y preparación para el lanzamiento

Mercado Pago es un **servicio imprescindible para lanzar**, no una integración opcional para el mercado argentino. El repositorio contiene flujos de checkout, notificación/webhook y actualización del estado del pago, además de la lógica para calcular la comisión de marketplace. **La configuración actual bloquea deliberadamente el modo de producción y la división de comisiones en vivo hasta validar de punta a punta el OAuth del vendedor y el flujo de pago**; debe considerarse implementado en sandbox, pero con el lanzamiento en producción todavía bloqueado. Stripe Connect y PayPal Partner también están preparados para pruebas sandbox; no se presentan aquí como integraciones listas para producción.

### Qué ofrece actualmente la aplicación

| Área | Implementación verificada | Límite / estado importante |
|---|---|---|
| Pagos | Mercado Pago es la integración prioritaria; existen flujos de checkout y webhook/estado del pedido. También hay flujos de Stripe y PayPal Connect. | Las conexiones se muestran en modo SANDBOX. La división de pagos de marketplace en vivo debe completarse y validarse antes del lanzamiento. |
| Catálogo e inventario | Catálogo de productos, variantes, talles/SKU, control de stock, administración del catálogo, umbral configurable de stock bajo y vía de alertas por Telegram. | Es el catálogo de una tienda, no catálogos separados para comercios independientes registrados como tenants. |
| Pedidos y cuentas | Checkout, inicio de sesión, configuración de Google OAuth, direcciones guardadas, historial de pedidos, flujo de cancelación, seguimiento del envío y fecha estimada de entrega. | No hay registro autónomo de tiendas/tenants ni roles de equipo por comercio. |
| Envíos | Zipnova para Argentina, Shippo para destinos internacionales, retiro en tienda/tarifa local configurables y selección automática del envío a domicilio más barato (con una alternativa más rápida cuando existe). | La disponibilidad real depende de credenciales, cobertura y configuración del entorno; siguen aplicándose restricciones de sandbox. |
| Emails transaccionales | Confirmación de compra, avisos de preparación/en tránsito y cambios en la fecha estimada mediante Brevo, con protecciones de idempotencia. | Se requiere un remitente verificado y credenciales de Brevo para producción. |
| Operaciones y métricas | Panel de administración, pedidos, controles de inventario, alertas de stock bajo, visitas/dispositivos, conversión, ticket promedio, productos principales e ingresos de pedidos completados. | Son métricas de una tienda, no una consola analítica para un SaaS multi-tenant. |
| Retención y confianza | Carrito/lista de deseos persistentes, reseñas restringidas a compras entregadas verificadas, interfaz en español e inglés, gestión de impuestos/monedas y flujo de solicitudes legales de consumidores. | No hay constructor visual de páginas ni panel no-code para personalizar una tienda. |
| Alquileres | Reservas de inventario usadas durante el checkout. | **No es un sistema completo de alquileres:** no hay calendario de alquiler, disponibilidad por fechas de inicio/fin, precios por duración ni flujo de contratos de alquiler. |
| SaaS / alojamiento | Existen bases para configurar la comisión de plataforma y conectar proveedores de pago. El panel puede mostrar la comisión sobre pedidos completados. | **Todavía no es un SaaS multi-tenant completo:** faltan aislamiento entre tiendas, registro autónomo de comercios, dominio personalizado por tienda, límites de funciones por plan y facturación automática de suscripciones. El 10% configurado no demuestra que la comisión se esté cobrando en producción. |
| Soporte | Existen páginas de contacto, soporte/FAQ y solicitudes legales. | No hay un SLA publicado ni un sistema de tickets/plan de soporte dedicado. |

### Comparación con competidores (referencias públicas de precios)

Los precios siguientes se revisaron el 23-10-2026 y son referencias, no cotizaciones garantizadas. Las promociones, impuestos, facturación anual, conversión de moneda y cargos de procesamiento de pagos pueden cambiar el costo real. Verificá los precios actuales de cada proveedor antes de usarlos comercialmente.

| Competidor | Modelo / precio público de referencia | Qué implica al compararlo con este proyecto |
|---|---|---|
| [Tiendanube](https://www.tiendanube.com/planes-y-precios) | Plan inicial gratuito; referencias de planes pagos cercanas a ARS 27.999 / 79.999 / 244.999 por mes. Algunos planes agregan cargos de plataforma del 2% / 1% / 0,7% para medios de pago externos. | Alternativa local consolidada con funciones restringidas por plan. Este proyecto reúne inventario, flujos de envío y emails transaccionales, pero todavía no ofrece un SaaS multi-tenant en producción. |
| Empretienda | Cerca de ARS 10.490 por mes; anuncia que no cobra comisión de plataforma por venta. | El bajo costo fijo es una competencia fuerte. Sus permisos de equipo no equivalen a cuentas individuales con roles. |
| EmpreLink | Cerca de ARS 9.500 / 17.999 / 29.999 por mes. | Los planes limitan, entre otras cosas, administradores y capacidades de imágenes/videos de productos. |
| Protienda | Cerca de ARS 16.900 / 35.900 / 62.900 por mes. | El límite de productos depende del plan; una cuota fija puede resultar más barata que un porcentaje cuando crecen las ventas. |
| Wendo | Cerca de ARS 24.900 / 49.900 / 89.900 por mes en sus planes publicados. | Algunos planes limitan las ventas mensuales completadas (por ejemplo, 100 / 300 / 800) y reservan funciones avanzadas de marketing/analítica para planes superiores. |
| [Jumpseller](https://jumpseller.com/pricing/) | Referencia inicial cercana a ARS 10.800 por mes equivalente con facturación anual; los planes superiores cuestan más. | No anuncia comisión de plataforma por transacción, aunque las funciones avanzadas se distribuyen por plan. |
| [Shopify](https://www.shopify.com/pricing) | Referencia internacional de US$29 / US$79 / US$299 mensuales equivalentes con facturación anual. | Ecosistema amplio y límites por plan para usuarios/funciones; los medios de pago externos pueden sumar cargos de plataforma. El precio regional puede variar. |
| [WooCommerce](https://woocommerce.com/pricing/) | El software principal es gratuito; el hosting, las extensiones pagas, la implementación y el mantenimiento se cobran aparte. | Da más control y propiedad, pero el comercio debe presupuestar configuración técnica y operación continua. |
| [Booqable](https://booqable.com/pricing/) y herramientas especializadas en alquiler como Alugable | Las referencias de SaaS de alquiler comienzan cerca de US$29 por mes; los planes superiores suman funciones. | Son referencias directas para flujos de alquiler, pero este repositorio aún no iguala sus calendarios y precios por duración. |
| Desarrollo freelance / a medida | Ejemplos de presupuestos publicados van aproximadamente de US$500–900 por configurar una tienda básica a US$1.200–3.500+ por desarrollo e integraciones personalizadas. | El pago inicial no se compara directamente con un SaaS; hosting, mantenimiento, comisiones de pago/envío y cambios futuros pueden cobrarse aparte. El alcance varía mucho. |

### Qué significa cobrar el 10% de comisión

Una comisión del 10% sin abono mensual es fácil de explicar y puede atraer a una tienda nueva con pocas ventas, especialmente si incluye integraciones útiles y automatización operativa. Sin embargo, se vuelve cara frente a los competidores de precio fijo cuando la tienda crece:

| Ventas mensuales de la tienda | Comisión del 10% |
|---:|---:|
| ARS 100.000 | ARS 10.000 |
| ARS 300.000 | ARS 30.000 |
| ARS 500.000 | ARS 50.000 |
| ARS 1.000.000 | ARS 100.000 |

Con ARS 100.000 en ventas mensuales, la comisión ya equivale a varios planes básicos. Con ARS 300.000 supera muchas suscripciones básicas e intermedias; con ARS 500.000 llega a ARS 50.000, antes de los cargos de procesamiento de pagos. No son precios totalmente equivalentes: una suscripción fija puede cobrar aparte el procesamiento, mientras que una comisión puede agrupar software y operación.

**Conclusión comercial:** el modelo del 10% es más defendible si no hay cuota mensual y el servicio aporta valor medible (Mercado Pago, selección/seguimiento confiable de envíos, emails transaccionales, controles de inventario y soporte operativo). El código actual por sí solo no justifica presentarlo como un SaaS listo para producción: siguen pendientes los pagos de marketplace en vivo, el aislamiento entre tiendas, los dominios por comercio, la facturación automática de suscripciones y los flujos completos de alquiler. Antes de venderlo como un servicio alojado para múltiples tiendas, completá y validá esos bloqueos. Considerá una comisión menor/decreciente, un plan mensual o un tope de comisión para tiendas con más volumen.

## 🧪 QA & Testing Automation (Playwright)

El repositorio incluye una suite completa de pruebas End-to-End (E2E) robusta diseñada bajo el patrón de arquitectura **Page Object Model (POM)**.

### Enfoque de Pruebas:

- **Mantenibilidad:** Separación estricta de selectores y flujos lógicos en clases independientes (`CatalogPage`).
- **Agnóstico al Entorno:** Configuración dinámica que permite ejecutar los tests tanto en `localhost` como contra el dominio ya hosteado en producción (`TEST_BASE_URL`).
- **Interceptación de Rutas:** Simulación de flujos mediante el mockeo de respuestas API (`page.route`) para testear estados vacíos o errores del servidor de manera aislada.

Para ejecutar los tests interactivos con interfaz visual:

```bash
npx playwright test --ui


Instalación y Configuración Local

Para replicar este entorno de desarrollo localmente, seguí estos pasos:

Clonar el repositorio:
git clone [https://github.com/tu-usuario/nova-store.git](https://github.com/tu-usuario/nova-store.git)
cd nova-store

Instalar las dependencias de Node.js:
npm install

Configurar las variables de entorno:
Crea un archivo llamado .env.local en la raíz del proyecto y agrega tus credenciales correspondientes:

NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# NextAuth Config
NEXTAUTH_SECRET="tu_secreto_super_seguro_para_produccion"
NEXTAUTH_URL="http://localhost:3001"
GOOGLE_CLIENT_ID="tu_client_id_de_google_console"
GOOGLE_CLIENT_SECRET="tu_client_secret_de_google_console"

# Mercado Pago Sandbox
MERCADOPAGO_ACCESS_TOKEN="TEST-tu-access-token-de-prueba"

# Aiven Database URL
DATABASE_URL="postgresql://user:password@aiven-host:port/dbname"

Levantar el servidor de desarrollo:
npm run dev

Una vez ejecutado el comando, abrí http://localhost:3001 en tu navegador para interactuar con la plataforma.
```
