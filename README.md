# 🛒 Senior Store - E-Commerce de Alta Performance

¡Bienvenido a **Senior Store**! Una aplicación web de comercio electrónico moderna, rápida y escalable construida con arquitectura de vanguardia en Next.js. El proyecto simula una tienda de ropa exclusiva integrando flujos complejos de autenticación, persistencia de datos en la nube, pasarela de pagos y testing automatizado.

---

## 🚀 Stack Tecnológico & Arquitectura

Este proyecto fue diseñado bajo estándares de nivel producción, priorizando el desacoplamiento de componentes y la optimización del rendimiento:

*   **Frontend:** `Next.js 15+ (App Router)` aprovechando la potencia de los **Server Components (RSC)** para cargas asíncronas inmediatas y SEO optimizado.
*   **Estilos:** `Tailwind CSS` con un diseño minimalista, responsivo y animaciones fluidas (`ease-out`).
*   **Base de Datos en la Nube:** `Aiven (PostgreSQL)` para garantizar persistencia robusta del historial de compras y perfiles de usuario.
*   **API Layer:** `GraphQL` local mediante peticiones `fetch` nativas, optimizando la transferencia de datos y evitando el over-fetching.
*   **Gestión de Estado Global:** `Zustand` para el manejo del carrito de compras en memoria, logrando actualizaciones en tiempo real sin re-renders innecesarios.
*   **Autenticación:** `NextAuth.js` integrado de forma segura con Google OAuth y almacenamiento de sesiones en base de datos.
*   **Pasarela de Pagos:** `Mercado Pago SDK` integrado dinámicamente mediante Webhooks y Query Params para la transición de órdenes a estados aprobados (`PAID`).

---

## ✨ Características Principales (Features)

1.  **Buscador Sincronizado en URL:** Filtrado instantáneo del catálogo mediante *Query Params* (`?search=...`). Permite compartir enlaces con búsquedas ya pre-cargadas de forma orgánica.
2.  **Skeleton Loader Premium:** Implementación de pantallas de carga animadas (`animate-pulse`) dentro de bloques `<Suspense />` para mejorar la percepción de velocidad del usuario (UX).
3.  **Lista de Deseos (Wishlist):** Persistencia independiente de productos favoritos por usuario de manera reactiva.
4.  **Historial de Órdenes Dinámico:** Sección exclusiva ("Mis Compras") protegida por NextAuth que lee y mapea las órdenes procesadas desde Aiven de forma segura.

---

## 🧪 QA & Testing Automation (Playwright)

El repositorio incluye una suite completa de pruebas End-to-End (E2E) robusta diseñada bajo el patrón de arquitectura **Page Object Model (POM)**.

### Enfoque de Pruebas:
*   **Mantenibilidad:** Separación estricta de selectores y flujos lógicos en clases independientes (`CatalogPage`).
*   **Agnóstico al Entorno:** Configuración dinámica que permite ejecutar los tests tanto en `localhost` como contra el dominio ya hosteado en producción (`TEST_BASE_URL`).
*   **Interceptación de Rutas:** Simulación de flujos mediante el mockeo de respuestas API (`page.route`) para testear estados vacíos o errores del servidor de manera aislada.

Para ejecutar los tests interactivos con interfaz visual:
```bash
npx playwright test --ui


Instalación y Configuración Local

Para replicar este entorno de desarrollo localmente, seguí estos pasos:

Clonar el repositorio:
git clone [https://github.com/tu-usuario/senior-store.git](https://github.com/tu-usuario/senior-store.git)
cd senior-store

Instalar las dependencias de Node.js:
npm install

Configurar las variables de entorno:
Crea un archivo llamado .env.local en la raíz del proyecto y agrega tus credenciales correspondientes:

NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# NextAuth Config
NEXTAUTH_SECRET="tu_secreto_super_seguro_para_produccion"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="tu_client_id_de_google_console"
GOOGLE_CLIENT_SECRET="tu_client_secret_de_google_console"

# Mercado Pago Sandbox
MERCADOPAGO_ACCESS_TOKEN="TEST-tu-access-token-de-prueba"

# Aiven Database URL
DATABASE_URL="postgresql://user:password@aiven-host:port/dbname"

Levantar el servidor de desarrollo:
npm run dev

Una vez ejecutado el comando, abrí http://localhost:3000 en tu navegador para interactuar con la plataforma.