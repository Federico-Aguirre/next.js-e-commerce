import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Link } from '@/lib/I18nRouting';
import ConsumerRequestForm from './ConsumerRequestForm';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === 'es'
    ? {
        title: 'Botón de arrepentimiento | NOVA STORE',
        description: 'Solicitá la revocación de una compra sin iniciar sesión.',
      }
    : {
        title: 'Withdrawal request | NOVA STORE',
        description: 'Request withdrawal from a purchase without signing in.',
      };
}

export default async function WithdrawalPage() {
  const locale = await getLocale();
  const es = locale === 'es';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col py-10 sm:py-14">
      <Link
        className="mb-6 text-sm font-medium text-muted-foreground underline underline-offset-4"
        href="/legal"
      >
        {es ? 'Volver a información legal' : 'Back to legal information'}
      </Link>
      <div className="rounded-2xl border p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {es ? 'Derechos del consumidor' : 'Consumer rights'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {es ? 'BOTÓN DE ARREPENTIMIENTO' : 'Withdrawal request'}
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          {es
            ? 'Usá este formulario para solicitar la revocación de una compra a distancia cuando corresponda. No necesitás registrarte ni iniciar sesión. El número de pedido es opcional; si no lo tenés a mano, igualmente podés enviar la solicitud.'
            : 'Use this form to request withdrawal from a distance purchase where applicable. You do not need to register or sign in. The order number is optional; you may submit the request without it.'}
        </p>
        <p className="mt-3 leading-7 text-muted-foreground">
          {es
            ? 'En Argentina, el plazo general es de diez (10) días corridos desde la entrega del bien o la celebración del contrato, lo que ocurra último, sujeto a excepciones legales. Una vez enviada la solicitud, se mostrará un código para identificarla.'
            : 'In Argentina, the general period is ten (10) calendar days from delivery or contract conclusion, whichever occurs later, subject to statutory exceptions. A reference code will be displayed after submission.'}
        </p>
        <div className="mt-7">
          <ConsumerRequestForm />
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          {es
            ? 'Este formulario no requiere contraseña ni cuenta. Si tu pedido está identificado, el comercio verificará los datos para tramitar la solicitud y te informará los pasos siguientes.'
            : 'This form does not require a password or account. If your order is identifiable, the store will verify the details to process the request and inform you of the next steps.'}
        </p>
      </div>
    </div>
  );
}
