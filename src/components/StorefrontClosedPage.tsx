import enMessages from '@/locales/en.json';
import esMessages from '@/locales/es.json';

export default function StorefrontClosedPage({
  locale,
  mode,
}: {
  locale: 'en' | 'es';
  mode: 'CLOSED' | 'UNAVAILABLE';
}) {
  const copy = locale === 'en' ? enMessages.StorefrontClosed : esMessages.StorefrontClosed;
  const prefix = locale === 'en' ? '/en' : '/es';
  const title = mode === 'UNAVAILABLE' ? copy.unavailableTitle : copy.title;
  const description = mode === 'UNAVAILABLE' ? copy.unavailableDescription : copy.description;

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6"
      >
        <section className="w-full max-w-2xl rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
            <h2 className="font-semibold">{copy.ordersTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.ordersDescription}</p>
          </div>
          <nav
            aria-label={copy.linksLabel}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium"
          >
            <a
              className="underline underline-offset-4 hover:text-primary"
              href={`${prefix}/sign-in`}
            >
              {copy.signInLink}
            </a>
            <a
              className="underline underline-offset-4 hover:text-primary"
              href={`${prefix}/account`}
            >
              {copy.accountLink}
            </a>
            <a
              className="underline underline-offset-4 hover:text-primary"
              href={`${prefix}/contact`}
            >
              {copy.contactLink}
            </a>
            <a className="underline underline-offset-4 hover:text-primary" href={`${prefix}/legal`}>
              {copy.legalLink}
            </a>
          </nav>
        </section>
      </main>
    </>
  );
}
