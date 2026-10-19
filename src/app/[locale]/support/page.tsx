import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  LifeBuoy,
  PackageCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/I18nRouting';
import ContactForm from '../contact/ContactForm';

type SupportPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: SupportPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Support' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function SupportPage({ params }: SupportPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Support');

  const topics = [
    {
      icon: PackageCheck,
      title: t('topics.orders.title'),
      description: t('topics.orders.description'),
      action: t('topics.orders.action'),
      href: '/historial',
    },
    {
      icon: UserRound,
      title: t('topics.account.title'),
      description: t('topics.account.description'),
      action: t('topics.account.action'),
      href: '/account',
    },
    {
      icon: CreditCard,
      title: t('topics.payments.title'),
      description: t('topics.payments.description'),
      action: t('topics.payments.action'),
      href: '#contact',
    },
    {
      icon: ShoppingBag,
      title: t('topics.products.title'),
      description: t('topics.products.description'),
      action: t('topics.products.action'),
      href: '/products',
    },
  ] as const;

  const faqs = [
    { question: t('faq.orders.question'), answer: t('faq.orders.answer') },
    { question: t('faq.payment.question'), answer: t('faq.payment.answer') },
    { question: t('faq.cancel.question'), answer: t('faq.cancel.answer') },
    { question: t('faq.delivery.question'), answer: t('faq.delivery.answer') },
    { question: t('faq.tracking.question'), answer: t('faq.tracking.answer') },
    { question: t('faq.security.question'), answer: t('faq.security.answer') },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section
        aria-labelledby="support-title"
        className="border-border relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-10 sm:px-10 sm:py-14"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-sm font-medium text-primary">
            <LifeBuoy className="size-4" aria-hidden="true" />
            <span>{t('eyebrow')}</span>
          </div>
          <h1 id="support-title" className="text-3xl font-bold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {t('description')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('contactButton')}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <Link
              href="/historial"
              className="border-border inline-flex min-h-11 items-center justify-center gap-2 rounded-full border bg-background px-5 py-2.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('ordersButton')}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="support-topics-title" className="mt-12">
        <div className="mb-5">
          <h2 id="support-topics-title" className="text-2xl font-bold tracking-tight">
            {t('topics.title')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('topics.description')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topics.map((topic) => {
            const Icon = topic.icon;
            const isAnchor = topic.href.startsWith('#');

            const cardContent = (
              <>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="mt-4 block text-base font-semibold">{topic.title}</span>
                <span className="mt-2 block flex-1 text-sm leading-6 text-muted-foreground">
                  {topic.description}
                </span>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  {topic.action}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </span>
              </>
            );

            const className =
              'group flex min-h-56 flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

            return isAnchor ? (
              <a key={topic.title} href={topic.href} className={className}>
                {cardContent}
              </a>
            ) : (
              <Link key={topic.title} href={topic.href} className={className}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="support-faq-title" className="mt-14">
        <div className="mb-5">
          <h2 id="support-faq-title" className="text-2xl font-bold tracking-tight">
            {t('faq.title')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('faq.description')}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group border-border bg-card h-fit rounded-2xl border px-5 py-4 open:border-primary/30 open:bg-muted/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 pr-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        id="contact"
        aria-labelledby="support-contact-title"
        className="border-border mt-14 scroll-mt-28 rounded-3xl border bg-muted/30 p-5 sm:p-8 lg:p-10"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          <div className="pt-2">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LifeBuoy className="size-6" aria-hidden="true" />
            </span>
            <h2
              id="support-contact-title"
              className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl"
            >
              {t('contact.title')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {t('contact.description')}
            </p>
            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{t('contact.privacyNote')}</span>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
