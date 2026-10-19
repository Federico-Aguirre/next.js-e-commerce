# Legal setup before opening the storefront

The public pages `/legal` and `/arrepentimiento` are implemented in Spanish and English. The withdrawal-request table is migrated in Aiven. This document is an internal launch checklist, not public-facing legal advice.

## 1. Configure the actual seller

Complete the following variables in the deployment environment using the merchant's real legal details. The app intentionally does not guess these values:

- `STORE_PUBLIC_NAME` — public shop name.
- `STORE_LEGAL_NAME` — registered legal name / actual individual merchant name.
- `STORE_LEGAL_TAX_ID` — actual CUIT or applicable tax identifier.
- `STORE_LEGAL_ADDRESS` — actual physical/legal address.
- `STORE_LEGAL_EMAIL` — published email for support and legal requests (falls back to `CONTACT_RECIPIENT_EMAIL`).
- `STORE_LEGAL_PHONE` — support telephone.
- `STORE_LEGAL_HOURS` — real customer-service days and hours.

`RESEND_API_KEY`, `RESEND_FROM_EMAIL` and either `STORE_LEGAL_EMAIL` or `CONTACT_RECIPIENT_EMAIL` must be configured for withdrawal notices to be emailed. Do not copy example placeholder values into production. Registration is persisted even if email sending fails; the admin must check `/dashboard/solicitudes-legales`.

## 2. Withdrawal requests

The “BOTÓN DE ARREPENTIMIENTO” link is in the global footer legal section and opens `/arrepentimiento` without sign-in. This footer placement follows a common Argentine storefront pattern (e.g. Tiendanube), but review prominence/first-access requirements under the current rules before launch. The request is persisted with a unique reference code and shown in the admin dashboard. Verify each request, apply the consumer's statutory rights, communicate the registration code/next steps within the applicable deadline (including the 24-hour rule under Disposición 954/2025), and do not treat registration as an automatic refund.

## 3. Privacy/analytics

Optional PostHog analytics and the store's visit counter do not start until the visitor accepts the analytics prompt. The floating cookie-preferences control lets the visitor reopen the choice. Verify that future analytics services are also gated by this consent; strictly necessary cart/session storage should remain operational without optional analytics.

Third-party disclosure on the public policy describes the providers currently integrated: Vercel, Aiven, Google sign-in when used, Resend, Mercado Pago, Stripe, PayPal, Zipnova/Shippo where shipping is configured, and PostHog only following consent. Revisit this list when the stack changes.

## 4. Important pre-launch legal conflict: price disclosure

The shared `TaxInclusivePrice` component now shows the final ARS price plus a smaller line containing the exact “PRECIO SIN IMPUESTOS NACIONALES” legend and the pre-tax ARS amount. Resolution 4/2025, Article 2(c), sets this display rule. Before launch, verify each customer-facing price listing/advertisement uses this component or follows the same presentation, and ask qualified counsel about any product-specific indirect taxes not represented by the current IVA-only calculator.

## 5. Verify actual operating policies

Before going live, the merchant should confirm the return address, real shipping fees and time windows, invoices/tax treatment, warranty/repair process, cancellation/refund execution for each payment provider, and the seller data shown to customers. The generic policy text does not replace a lawyer's review of the specific merchant and products.
