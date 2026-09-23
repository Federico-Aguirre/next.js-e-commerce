import { getTranslations } from 'next-intl/server';

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

  return (
    <main className="container mx-auto flex min-h-[90dvh] flex-col items-center justify-center">
      <div className="mb-8 w-full max-w-xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">{t('description')}</p>
      </div>

      <ContactForm />
    </main>
  );
}
