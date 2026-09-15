# Arquitectura del Sistema: E-Commerce Multiplataforma

## Visión General

Repositorio híbrido que alberga la versión Web principal (Next.js) y la aplicación Móvil (React Native + Expo), compartiendo tipos de TypeScript, lógica de negocio y consumo de APIs.

---

## Estructura Principal del Repositorio

### 1. Aplicación Web (`src/` y `public/`)

- `src/app/` -> Rutas, páginas, API endpoints y Server Actions de Next.js.
- `src/assets/` -> Recurso visuales, íconos vectoriales e imágenes internas del código web.
- `src/components/` -> Componentes UI web (Tailwind CSS + HTML).
- `src/lib/` -> Clientes de servicios, instancia de Prisma y utilidades del servidor.
- `src/store/` -> Estado global Zustand (`useCartStore`, `useUserStore`, `useWishlistStore`).
- `src/types/` -> Tipos e interfaces compartidas de TypeScript para el modelo de datos.
- `src/proxy.ts` -> Middleware de seguridad para enrutamiento y autenticación JWT con NextAuth (protección de rutas como `/checkout`).
- `public/` -> Archivos estáticos accesibles directamente por URL en la web (imágenes públicas, favicons, logos).

### 2. Aplicación Móvil (`ecommerce-mobile/`)

- `ecommerce-mobile/src/app/` -> Rutas nativas manejadas por Expo Router (`index.tsx`, `_layout.tsx`).
- `ecommerce-mobile/src/components/` -> Componentes nativos (NativeWind v4 + React Native).
- `ecommerce-mobile/src/services/` -> Servicios HTTP que consumen las APIs expuestas por la versión Web.

### 3. Base de Datos e Infraestructura

- `prisma/` -> Esquemas de base de datos (`schema.prisma`), semillas (seeds) y migraciones. (`prisma.config.ts`).
- `.github/` -> Workflows de integración continua (CI/CD) y GitHub Actions.
- `.vercel/` -> Archivos de estado y configuración del despliegue en Vercel.

### 4. Pruebas y Calidad de Código

- `src/tests/` y `src/test-results/` -> Pruebas unitarias/integración con Vitest (`vitest.config.ts`, `vitest.setup.ts`).
- `playwright.config.ts` y `playwright-report/` -> Pruebas End-to-End (E2E) automatizadas para la web.

### 5. Documentación y Configuración del Entorno

- `CLAUDE.md` / `AGENTS.md` -> Instrucciones y contexto adicional para modelos de IA y agentes.
- `README.md` / `README.en.md` -> Documentación principal del repositorio en español e inglés.
- Configuración del proyecto: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts`.
