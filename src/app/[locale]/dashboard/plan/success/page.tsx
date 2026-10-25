import { redirect } from 'next/navigation';
import { Link } from '@/lib/I18nRouting';
import { completeProPlanCheckout } from '@/lib/payments/pro-plan-checkout';
import { getDashboardAdmin } from '../../data';

type ProPlanSuccessPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function ProPlanSuccessPage({
  params,
  searchParams,
}: ProPlanSuccessPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const prefix = locale === 'es' ? '/es' : '';
  const admin = await getDashboardAdmin();
  if (!admin) redirect(`${prefix}/sign-in`);

  const sessionId = query.session_id?.trim();
  if (!sessionId || !admin.user.id) {
    return <InvalidCheckoutReturn locale={locale} />;
  }

  let storefrontClosed = false;
  try {
    const result = await completeProPlanCheckout(sessionId, admin.user.id);
    storefrontClosed = result.storefrontClosed === true;
  } catch (error) {
    console.error('No se pudo confirmar el pago del plan Pro.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return <InvalidCheckoutReturn locale={locale} />;
  }

  redirect(`${prefix}/dashboard?planPayment=${storefrontClosed ? 'storeClosed' : 'success'}`);
}

function InvalidCheckoutReturn({ locale }: { locale: string }) {
  const href = locale === 'es' ? '/es/dashboard' : '/dashboard';
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <section className="rounded-2xl border p-6">
        <h1 className="text-xl font-semibold">
          {locale === 'es' ? 'No pudimos confirmar el pago' : 'We could not confirm the payment'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {locale === 'es'
            ? 'No se activó el plan Pro. Verificá el estado del pago en Stripe y volvé al panel; no se cambia el plan hasta confirmar el importe y el estado del pago.'
            : 'The Pro plan was not activated. Check the payment status in Stripe and return to the dashboard; the plan only changes after the amount and payment status are verified.'}
        </p>
        <Link
          href={href}
          className="mt-5 inline-flex rounded-md border px-4 py-2 text-sm font-medium"
        >
          {locale === 'es' ? 'Volver al panel' : 'Return to dashboard'}
        </Link>
      </section>
    </main>
  );
}
