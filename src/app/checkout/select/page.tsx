import BuyNowPaymentSelector from '@/components/checkout/BuyNowPaymentSelector';

type CheckoutSelectPageProps = {
  searchParams: Promise<{ lang?: string | string[] }>;
};

export default async function CheckoutSelectPage({ searchParams }: CheckoutSelectPageProps) {
  const params = await searchParams;
  const requestedLanguage = Array.isArray(params.lang) ? params.lang[0] : params.lang;

  return <BuyNowPaymentSelector language={requestedLanguage === 'en' ? 'en' : 'es'} />;
}
