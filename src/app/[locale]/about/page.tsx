import { setRequestLocale } from 'next-intl/server';

import { AboutContent } from './AboutContent';

export default async function AboutPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <AboutContent />;
}
