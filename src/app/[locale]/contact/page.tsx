import { getLocale, getTranslations } from 'next-intl/server';
import ContactData from './ContactData';
import ContactForm from './ContactForm';

export async function generateMetadata() {
  const t = await getTranslations('contact');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ContactPage() {
  const t = await getTranslations('contact');
  const locale = await getLocale();

  return (
    <main className="container mx-auto flex min-h-[90dvh] flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 w-full max-w-5xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
        <ContactForm />
        <ContactData locale={locale} />
      </div>
    </main>
  );
}
