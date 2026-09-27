# System Architecture: Multi-Platform E-Commerce

## 1. System Overview

This repository houses a hybrid multi-platform e-commerce solution. It integrates a primary Web application powered by Next.js (App Router with i18n) and a Mobile application built with React Native and Expo. Both platforms share TypeScript data models, business domain logic, and API endpoints.

---

## 2. Repository Directory Structure

### Web Application (`src/` and `public/`)

- `src/actions/`: Next.js Server Actions for authenticated workflows such as login actions and contact form submissions.
- `src/app/[locale]/`: Internationalized App Router routes (`/en`, `/es`) covering authentication, catalog, product details, cart, checkout, favorites, and user order history.
- `src/app/api/`: REST and GraphQL API endpoints handling authentication (NextAuth), payment processing (MercadoPago, PayPal, Stripe), webhooks, and database health checks.
- `src/commerce/`: Core domain business layer isolated from the UI, containing domain models, contracts, customer logic, pricing engines, promotional rules, and catalog adapters.
- `src/components/`: Modular UI components divided into domain-specific modules (storefront grids, catalog filters, checkout payment forms, theme toggles, and state synchronizers).
- `src/data/`: Static seed data and product fallback definitions.
- `src/hooks/`: Custom React hooks for client workflows such as card checkout execution.
- `src/i18n/` & `src/locales/`: Localization configuration and translation dictionaries (`en.json`, `es.json`).
- `src/lib/`: Server utilities, environment variable validation, Prisma ORM retry client, and Zod schemas.
- `src/providers/`: Application context providers including analytics (PostHog) and global providers.
- `src/proxy.ts`: Security middleware regulating route access and JWT authentication validation.
- `src/services/`: Abstraction services for client-side and server-side HTTP communications.
- `src/store/`: Global state management powered by Zustand (`useCartStore`, `useUserStore`, `useWishlistStore`, `useAppStore`).
- `src/types/`: Shared TypeScript type definitions, domain models, and UI interfaces.
- `public/`: Publicly accessible static assets, including brand logos and product images.

### Mobile Application (`ecommerce-mobile/`)

- `ecommerce-mobile/src/app/`: Native navigation routes managed by Expo Router.
- `ecommerce-mobile/src/components/`: Native cross-platform UI components styled with NativeWind v4 and React Native.
- `ecommerce-mobile/src/services/`: Native HTTP client modules connecting the mobile app to Web API routes.

### Database and Infrastructure (`prisma/`)

- `prisma/`: Relational database schema (`schema.prisma`), SQL migration scripts, database seeds (`seed.ts`), and configuration (`prisma.config.ts`).
- `certificates/`: Local SSL certificates (`localhost.pem`) for local HTTPS development.

### Quality Assurance, Testing, and Tooling

- `tests/`: End-to-End (E2E) test suites using Playwright with page-object models (`tests/page-objects/`).
- `vitest.config.ts` & `vitest.setup.ts`: Unit and integration testing setup managed by Vitest.
- Tooling and Code Quality:
  - `oxlint.config.ts`, `oxfmt.config.ts`, `eslint.config.mjs`: High-performance linting and formatting tools.
  - `lefthook.yml`: Git hooks manager enforcing automated pre-commit quality checks.
  - `commitlint.config.ts`: Commit message standard enforcement.
  - `knip.ts`: Unused file, export, and dependency analysis.
  - `checkly.config.ts` & `codecov.yml`: Synthetic API monitoring and code coverage tracking.

### AI Configuration and Knowledge Base (`ai/`)

- `ai/agents.md` & Symlinks (`AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `SECURITY.md`): Central context files and operational guidelines for AI coding assistants.
- `ai/doc/`: In-depth documentation covering architecture, domain benchmarks, Next.js, React, security, and styling guidelines.
- `ai/skills/`: Modular AI skills defining domain knowledge, database queries, mobile synchronization protocols, and UI rules.
