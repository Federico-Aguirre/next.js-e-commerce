import { redirect } from 'next/navigation';
import { Link } from '@/lib/I18nRouting';
import { prisma } from '@/lib/prisma';
import { getDashboardAdmin } from '../data';
import { updateConsumerRequestStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function LegalRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const es = locale === 'es';
  const admin = await getDashboardAdmin();

  if (!admin) {
    redirect('/' + locale + '/sign-in');
  }

  const requests = await prisma.consumerRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const dateLocale = es ? 'es-AR' : 'en-US';

  return (
    <div className="space-y-6 py-8">
      <Link className="text-sm font-medium underline underline-offset-4" href="/dashboard">
        {es ? '← Volver al panel' : '← Back to dashboard'}
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {es ? 'Solicitudes de arrepentimiento' : 'Withdrawal requests'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {es
            ? 'Solicitudes guardadas por el formulario público. Verificá el pedido, gestioná la revocación cuando corresponda y respondé dentro del plazo legal.'
            : 'Requests submitted through the public form. Verify the order, process withdrawal where applicable, and respond within the legal time limit.'}
        </p>
      </header>
      {requests.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          {es ? 'Todavía no hay solicitudes.' : 'There are no requests yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{request.requestCode}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'America/Argentina/Buenos_Aires',
                    }).format(request.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-medium">
                  {request.status === 'RECEIVED'
                    ? es
                      ? 'Recibida'
                      : 'Received'
                    : request.status === 'IN_REVIEW'
                      ? es
                        ? 'En revisión'
                        : 'In review'
                      : request.status === 'COMPLETED'
                        ? es
                          ? 'Resuelta'
                          : 'Resolved'
                        : request.status}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">
                    {es ? 'Correo del comprador' : 'Customer email'}
                  </dt>
                  <dd className="mt-1 break-all">
                    <a
                      className="underline underline-offset-4"
                      href={'mailto:' + request.customerEmail}
                    >
                      {request.customerEmail}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {es ? 'Número de pedido' : 'Order number'}
                  </dt>
                  <dd className="mt-1">
                    {request.orderNumber ?? (es ? 'No indicado' : 'Not provided')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {es ? 'Información adicional' : 'Additional information'}
                  </dt>
                  <dd className="mt-1 break-words whitespace-pre-wrap">{request.details || '—'}</dd>
                </div>
              </dl>
              <form
                action={updateConsumerRequestStatus}
                className="mt-5 flex flex-wrap items-end gap-3 border-t pt-4"
              >
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="locale" value={locale} />
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">
                    {es ? 'Estado de gestión' : 'Handling status'}
                  </span>
                  <select
                    name="status"
                    defaultValue={request.status}
                    className="min-h-10 rounded-md border bg-background px-3 py-2"
                  >
                    <option value="RECEIVED">{es ? 'Recibida' : 'Received'}</option>
                    <option value="IN_REVIEW">{es ? 'En revisión' : 'In review'}</option>
                    <option value="COMPLETED">{es ? 'Resuelta' : 'Resolved'}</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {es ? 'Guardar estado' : 'Save status'}
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
