import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Link } from '@/lib/I18nRouting';
import { missingStoreLegalDetails, StoreLegalConfig } from '@/utils/StoreLegalConfig';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === 'es'
    ? {
        title: 'Información legal y políticas | NOVA STORE',
        description:
          'Condiciones de compra, envíos, devoluciones, privacidad y datos del comercio.',
      }
    : {
        title: 'Legal information and policies | NOVA STORE',
        description: 'Terms of purchase, delivery, returns, privacy and seller details.',
      };
}

export default async function LegalPage() {
  const locale = await getLocale();
  const es = locale === 'es';
  const pendingLabels: Record<string, string> = es
    ? {
        STORE_LEGAL_NAME: 'Razón social o nombre legal',
        STORE_LEGAL_TAX_ID: 'CUIT / identificación fiscal',
        STORE_LEGAL_ADDRESS: 'Domicilio físico del vendedor',
        'STORE_LEGAL_EMAIL (o CONTACT_RECIPIENT_EMAIL)': 'Correo de contacto',
        STORE_LEGAL_PHONE: 'Teléfono de atención',
        STORE_LEGAL_HOURS: 'Días y horarios de atención',
      }
    : {
        STORE_LEGAL_NAME: 'Legal business or individual name',
        STORE_LEGAL_TAX_ID: 'Tax ID',
        STORE_LEGAL_ADDRESS: 'Seller physical address',
        'STORE_LEGAL_EMAIL (o CONTACT_RECIPIENT_EMAIL)': 'Contact email',
        STORE_LEGAL_PHONE: 'Customer support phone',
        STORE_LEGAL_HOURS: 'Customer support days and hours',
      };
  const detail = (value: string, fallback: string) => value || fallback;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 py-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {es ? 'Información para compradores' : 'Information for customers'}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {es ? 'Información legal y políticas' : 'Legal information and policies'}
        </h1>
        <p className="max-w-3xl leading-7 text-muted-foreground">
          {es
            ? 'Estas condiciones explican cómo se realizan las compras en la tienda, cómo se usan los datos personales y cómo ejercer los derechos del consumidor. No limitan los derechos obligatorios que establece la legislación aplicable.'
            : 'These policies explain how purchases work, how personal information is used, and how to exercise consumer rights. They do not limit any mandatory rights under applicable law.'}
        </p>
        <p className="text-sm text-muted-foreground">
          {es ? 'Última actualización: 17 de octubre de 2026.' : 'Last updated: October 17, 2026.'}
        </p>
      </header>

      <section id="comercio" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '1. Identificación del vendedor' : '1. Seller identification'}
        </h2>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">
              {es ? 'Nombre comercial' : 'Trading name'}
            </dt>
            <dd className="mt-1 font-medium">{StoreLegalConfig.publicName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {es ? 'Razón social / nombre legal' : 'Legal business / individual name'}
            </dt>
            <dd className="mt-1 font-medium">
              {detail(
                StoreLegalConfig.legalName,
                es ? 'Pendiente de configuración' : 'Not configured',
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {es ? 'CUIT / identificación fiscal' : 'Tax ID'}
            </dt>
            <dd className="mt-1 font-medium">
              {detail(StoreLegalConfig.taxId, es ? 'Pendiente de configuración' : 'Not configured')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {es ? 'Domicilio físico' : 'Physical address'}
            </dt>
            <dd className="mt-1 font-medium">
              {detail(
                StoreLegalConfig.address,
                es ? 'Pendiente de configuración' : 'Not configured',
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {es ? 'Correo de atención' : 'Customer support email'}
            </dt>
            <dd className="mt-1 font-medium">
              {StoreLegalConfig.email ? (
                <a
                  className="underline underline-offset-4"
                  href={'mailto:' + StoreLegalConfig.email}
                >
                  {StoreLegalConfig.email}
                </a>
              ) : es ? (
                'Pendiente de configuración'
              ) : (
                'Not configured'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{es ? 'Teléfono' : 'Phone'}</dt>
            <dd className="mt-1 font-medium">
              {detail(StoreLegalConfig.phone, es ? 'Pendiente de configuración' : 'Not configured')}
            </dd>
          </div>
          {StoreLegalConfig.supportHours ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">
                {es ? 'Horario de atención' : 'Support hours'}
              </dt>
              <dd className="mt-1 font-medium">{StoreLegalConfig.supportHours}</dd>
            </div>
          ) : null}
        </dl>
        {missingStoreLegalDetails.length > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-semibold">
              {es ? 'Faltan datos del vendedor' : 'Seller details are incomplete'}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {es
                ? 'Antes de vender al público, el titular del comercio debe completar los datos pendientes. No se han inventado un CUIT, domicilio ni razón social.'
                : 'Before selling to the public, the store operator must complete the missing details. No tax ID, address or legal name has been fabricated.'}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {missingStoreLegalDetails.map((field) => (
                <li key={field}>{pendingLabels[field] || field}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {es
            ? 'El vendedor contractual es el comercio identificado en esta sección. El proveedor técnico del software o del alojamiento del sitio no se convierte por ese solo hecho en vendedor de los productos. Esta aclaración no excluye responsabilidades que pudieran corresponder por ley.'
            : 'The contractual seller is the store identified in this section. The technical software or hosting provider does not become the seller merely by providing the website. This statement does not exclude liability imposed by law.'}
        </p>
      </section>

      <section id="compra" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '2. Condiciones de compra y precios' : '2. Purchase terms and pricing'}
        </h2>
        <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
          <p>
            {es
              ? 'La información publicada identifica las características principales de cada producto y la disponibilidad que informa el catálogo. La compra se solicita al completar el checkout; la orden queda sujeta a la confirmación del pago y a la validación de disponibilidad. Si surge un problema, se contactará al comprador usando los datos suministrados.'
              : 'Product pages describe the main characteristics and catalog availability. A purchase is submitted at checkout and is subject to payment confirmation and stock validation. If a problem arises, the buyer will be contacted using the details provided.'}
          </p>
          <p>
            {es
              ? 'Para compras en Argentina, la moneda de referencia es el peso argentino (ARS) y el precio final debe ser el que se informe antes de confirmar la operación. Para visitantes de otros países, la tienda puede mostrar una conversión estimada en dólares estadounidenses (USD); los impuestos, cargos de entrega, cargos aduaneros o conversiones que correspondan al destino deben quedar claros antes de pagar.'
              : 'For purchases in Argentina, the reference currency is the Argentine peso (ARS), and the final price must be shown before the order is confirmed. Visitors elsewhere may see an estimated US dollar (USD) conversion; any applicable destination taxes, delivery fees, customs charges or conversion costs must be made clear before payment.'}
          </p>
          <p>
            {es
              ? 'Solo deben considerarse confirmados los importes y medios de pago que figuren en el resumen final del checkout. Mercado Pago, Stripe y PayPal procesan operaciones de acuerdo con sus propias condiciones; las conversiones y cargos que aplique el emisor de una tarjeta pueden diferir de una cotización de referencia.'
              : 'Only amounts and payment methods shown in the final checkout summary should be treated as confirmed. Mercado Pago, Stripe and PayPal process transactions under their own terms; card-issuer conversions and charges may differ from a reference exchange rate.'}
          </p>
        </div>
      </section>

      <section id="envios" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es
            ? '3. Entregas, cambios y productos defectuosos'
            : '3. Delivery, returns and defective products'}
        </h2>
        <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
          <p>
            {es
              ? 'El comprador debe revisar y proporcionar una dirección de entrega correcta. Los plazos y la disponibilidad dependen del destino, el producto y el transportista; cuando la tienda informe un costo o una fecha estimada de entrega, esa información debe revisarse antes de finalizar la compra. Si el costo de envío no aparece en el resumen, consultá al comercio antes de pagar.'
              : 'The buyer must provide an accurate delivery address. Availability and delivery times depend on the destination, product and carrier. Any delivery cost or estimated date provided by the store should be reviewed before completing the purchase. If a shipping cost is not shown in the order summary, contact the store before paying.'}
          </p>
          <p>
            {es
              ? 'Los defectos, faltantes, daños y problemas de entrega deben comunicarse al comercio por el canal de contacto. Las garantías legales, derechos de reparación y demás remedios aplicables se mantienen vigentes; estas políticas no los sustituyen ni los reducen.'
              : 'Defects, missing items, damage and delivery issues should be reported to the store through its contact channel. Statutory warranties, repair rights and other remedies remain in effect; these policies do not replace or reduce them.'}
          </p>
          <p>
            {es
              ? 'Las condiciones particulares de cambios comerciales voluntarios (por ejemplo, por talle o preferencia) deben ser confirmadas con el comercio. Nada de ello limita el derecho legal de revocación cuando resulte aplicable.'
              : 'Any additional voluntary exchange policy (for example, for size or preference) must be confirmed with the store. This does not limit any statutory withdrawal right that applies.'}
          </p>
        </div>
      </section>

      <section id="arrepentimiento" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '4. Derecho de arrepentimiento' : '4. Right of withdrawal'}
        </h2>
        <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
          <p>
            {es
              ? 'En las ventas a distancia alcanzadas por la normativa argentina, el consumidor puede revocar la aceptación dentro de los diez (10) días corridos contados desde la entrega del bien o la celebración del contrato, lo que ocurra último, salvo las excepciones previstas por la ley. Cuando corresponda, los gastos de devolución están a cargo del vendedor.'
              : 'For distance sales covered by Argentine law, consumers may withdraw within ten (10) calendar days from delivery of the goods or conclusion of the contract, whichever occurs later, subject to statutory exceptions. Where applicable, return shipping costs are borne by the seller.'}
          </p>
          <p>
            {es
              ? 'Para iniciar la solicitud no hace falta crear una cuenta ni iniciar sesión. Usá el enlace “BOTÓN DE ARREPENTIMIENTO” del pie de página, disponible desde el sitio sin iniciar sesión. El formulario pide únicamente un correo de contacto y permite indicar, si lo tenés, el número de pedido. Se mostrará un código de registro y el comercio deberá informar por el mismo canal los pasos siguientes dentro del plazo legal.'
              : 'You do not need to create an account or sign in to submit a request. Use the “BOTÓN DE ARREPENTIMIENTO” link in the site footer; it is available without signing in. The form asks only for a contact email and lets you provide the order number if available. A reference code will be displayed, and the store must communicate the next steps through the same channel within the legal time limit.'}
          </p>
          <div className="pt-2">
            <Link
              href="/arrepentimiento"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground underline-offset-4 hover:underline"
            >
              {es ? 'BOTÓN DE ARREPENTIMIENTO' : 'Withdrawal request (Botón de arrepentimiento)'}
            </Link>
          </div>
        </div>
      </section>

      <section id="privacidad" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '5. Privacidad y datos personales' : '5. Privacy and personal data'}
        </h2>
        <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
          <p>
            {es
              ? 'El comercio puede tratar nombre, correo, teléfono, dirección de entrega, DNI cuando se solicite, datos de cuenta, compras, comunicaciones de soporte e identificadores de pedido para administrar cuentas, cobrar, entregar productos, prevenir fraude, atender reclamos y cumplir obligaciones legales o contables.'
              : 'The store may process names, email addresses, phone numbers, delivery addresses, DNI where requested, account details, purchases, support communications and order identifiers to manage accounts, collect payments, deliver products, prevent fraud, respond to claims and meet legal or accounting obligations.'}
          </p>
          <p>
            {es
              ? 'Los pagos son procesados por la pasarela elegida (Mercado Pago, Stripe o PayPal, según la opción disponible). Para operar la tienda, ciertos datos pueden pasar por proveedores tecnológicos como Vercel (alojamiento), Aiven (base de datos), Google cuando se utiliza el inicio de sesión de Google, Brevo (correo) y proveedores logísticos como Zipnova o Shippo cuando se contratan envíos. PostHog y las estadísticas de visitas se usan únicamente si aceptás la analítica opcional. Cada proveedor recibe solo los datos necesarios para su función; algunos pueden procesarlos fuera de Argentina.'
              : 'Payments are processed by the selected provider (Mercado Pago, Stripe or PayPal, depending on what is available). To operate the store, some data may pass through technology providers such as Vercel (hosting), Aiven (database), Google when Google sign-in is used, Brevo (email) and logistics providers such as Zipnova or Shippo when shipping services are used. PostHog and visit statistics are used only if you accept optional analytics. Each provider receives only the data needed for its function; some may process data outside Argentina.'}
          </p>
          <p>
            {es
              ? 'El responsable del tratamiento es el vendedor identificado en la sección 1. Los datos se conservan durante el tiempo necesario para gestionar la cuenta y la compra, resolver controversias y cumplir los plazos legales de conservación. Podés solicitar acceso, corrección, actualización o supresión cuando corresponda, escribiendo al correo de contacto del comercio. La supresión puede estar limitada cuando una norma exija conservar cierta información.'
              : 'The data controller is the seller identified in section 1. Data is retained as needed to manage accounts and purchases, resolve disputes and comply with mandatory retention periods. You may request access, correction, updating or deletion where applicable by contacting the store email. Deletion may be restricted when the law requires certain information to be retained.'}
          </p>
          <p>
            {es
              ? 'La Ley 25.326 reconoce derechos sobre los datos personales. La Agencia de Acceso a la Información Pública es la autoridad de control competente en Argentina. Esta política no reemplaza los derechos que otorgue la normativa aplicable.'
              : 'Argentina’s Personal Data Protection Law 25,326 provides rights over personal information. The Agency for Access to Public Information is the competent supervisory authority in Argentina. This policy does not replace rights provided by applicable law.'}
          </p>
          <p>
            {es ? 'Normativa y autoridad:' : 'Law and regulator:'}{' '}
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion"
              target="_blank"
              rel="noreferrer"
            >
              {es ? 'Ley de Protección de Datos Personales' : 'Personal Data Protection Law'}
            </a>
            {' · '}
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/aaip/datospersonales"
              target="_blank"
              rel="noreferrer"
            >
              {es
                ? 'Agencia de Acceso a la Información Pública'
                : 'Agency for Access to Public Information'}
            </a>
          </p>
        </div>
      </section>

      <section id="cookies" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '6. Cookies y analítica opcional' : '6. Cookies and optional analytics'}
        </h2>
        <p className="mt-4 leading-7 text-muted-foreground">
          {es
            ? 'La tienda utiliza almacenamiento local y tecnologías esenciales para funciones como la sesión, el carrito, la seguridad y las preferencias. La analítica opcional de PostHog, que puede medir navegación e interacciones de la sesión, solo se activa cuando la persona la acepta. Podés rechazarla o cambiar la elección desde el control de preferencias de cookies que aparece en la pantalla.'
            : 'The store uses local storage and essential technologies for functions such as sessions, the cart, security and preferences. Optional PostHog analytics, which may measure navigation and session interactions, is enabled only after you accept it. You can reject it or change your choice through the cookie-preferences control on screen.'}
        </p>
      </section>

      <section id="reclamos" className="scroll-mt-28 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {es ? '7. Consultas y reclamos' : '7. Questions and complaints'}
        </h2>
        <p className="mt-4 leading-7 text-muted-foreground">
          {es
            ? 'Para consultas, incidentes con una compra, garantías o entrega, usá el canal de contacto indicado en los datos del vendedor. Incluí el número de pedido cuando esté disponible y nunca envíes contraseñas, códigos de acceso ni datos completos de tarjetas.'
            : 'For questions, purchase issues, warranties or delivery matters, use the contact channel listed in the seller details. Include the order number when available and never send passwords, access codes or full payment-card details.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <Link className="underline underline-offset-4" href="/contact">
            {es ? 'Contactar al comercio' : 'Contact the store'}
          </Link>
          <Link className="underline underline-offset-4" href="/support">
            {es ? 'Centro de ayuda' : 'Help center'}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{es ? 'Fuentes oficiales' : 'Official sources'}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/normativa/nacional/638/actualizacion"
              target="_blank"
              rel="noreferrer"
            >
              {es ? 'Ley 24.240 de Defensa del Consumidor' : 'Consumer Protection Law 24,240'}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/normativa/nacional/norma-417152/texto"
              target="_blank"
              rel="noreferrer"
            >
              {es
                ? 'Disposición 954/2025: arrepentimiento y baja de servicios'
                : 'Disposition 954/2025: withdrawal and service cancellation'}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-4-2025-408455/texto"
              target="_blank"
              rel="noreferrer"
            >
              {es
                ? 'Resolución 4/2025 sobre exhibición de precios'
                : 'Resolution 4/2025 on price display'}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-3-2026-423007/texto"
              target="_blank"
              rel="noreferrer"
            >
              {es
                ? 'Disposición 3/2026 sobre verificación razonable de identidad y seguridad'
                : 'Disposition 3/2026 on reasonable identity and security verification'}
            </a>
          </li>
        </ul>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {es
            ? 'Esta página es información general para clientes, no asesoramiento jurídico individual. El comercio debe verificar que las condiciones reales, sus datos registrales, impuestos, facturación y operación coincidan con lo publicado y con la normativa que le resulte aplicable.'
            : 'This page provides general information to customers, not individual legal advice. The store operator must verify that actual practices, registration details, taxes, invoicing and operations match these statements and applicable law.'}
        </p>
      </section>
    </div>
  );
}
