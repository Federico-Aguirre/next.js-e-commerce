🌐 **Language:** **English** | [Spanish Version](README.es.md)

🛒 Nova Store - High-Performance E-Commerce

[![View Live Project](https://img.shields.io/badge/🚀_View_Live_Project-007ACC?style=for-the-badge&logo=vercel&logoColor=white)](https://next-js-e-commerce-999.vercel.app)

Welcome to Nova Store! A modern, fast, and scalable e-commerce web application built with cutting-edge architecture using Next.js. The project simulates an exclusive clothing store integrating complex authentication flows, cloud data persistence, payment gateway integration, and automated testing.

🚀 Tech Stack & Architecture
This project was built following production-grade standards, prioritizing component decoupling and performance optimization:

Frontend: Next.js 15+ (App Router) leveraging React Server Components (RSC) for instant asynchronous rendering and optimized SEO.

Styling: Tailwind CSS featuring a minimalist, responsive design with smooth animations (ease-out).

Cloud Database: Aiven (PostgreSQL) ensuring robust data persistence for order history and user profiles.

API Layer: Local GraphQL using native fetch requests, optimizing data transfer and avoiding over-fetching.

Global State Management: Zustand for in-memory shopping cart management, achieving real-time updates without unnecessary re-renders.

Authentication: NextAuth.js securely integrated with Google OAuth and database-backed session storage.

Payment Gateway: Mercado Pago SDK dynamically integrated via Webhooks and Query Params to handle order state transitions to approved (PAID).

✨ Key Features
URL-Synchronized Search: Instant catalog filtering via Query Params (?search=...). Allows sharing pre-filtered search results organically.

Premium Skeleton Loaders: Animated loading states (animate-pulse) wrapped in <Suspense/> boundaries to enhance user-perceived speed and UX.

Wishlist: Independent, reactive persistence of user favorite products.

Dynamic Order History: An exclusive "My Orders" section protected by NextAuth that securely fetches and maps processed orders from Aiven.

🧪 QA & Automated Testing (Playwright)
The repository includes a robust, end-to-end (E2E) test suite designed using the Page Object Model (POM) pattern.

Testing Approach:
Maintainability: Strict separation of selectors and logical flows into independent classes (CatalogPage).

Environment-Agnostic: Dynamic configuration enabling test execution both locally on localhost and against hosted production domains (TEST_BASE_URL).

Route Interception: Workflow simulation via API response mocking (page.route) to isolate and test empty states or server errors.

To run the interactive test suite with a UI:

Bash
npx playwright test --ui
🛠️ Local Installation & Setup
To replicate this development environment locally, follow these steps:

Clone the repository:

Bash
git clone https://github.com/your-username/nova-store.git
cd nova-store
Install Node.js dependencies:

Bash
npm install
Configure environment variables:
Create a .env.local file in the root directory and add your credentials:

Fragmento de código
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# NextAuth Config

NEXTAUTH_SECRET="your_super_secure_production_secret"
NEXTAUTH_URL="http://localhost:3001"
GOOGLE_CLIENT_ID="your_google_console_client_id"
GOOGLE_CLIENT_SECRET="your_google_console_client_secret"

# Mercado Pago Sandbox

MERCADOPAGO_ACCESS_TOKEN="TEST-your-test-access-token"

# Aiven Database URL

DATABASE_URL="postgresql://user:password@aiven-host:port/dbname"
Start the development server:

Bash
npm run dev
