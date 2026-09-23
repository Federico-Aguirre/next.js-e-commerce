import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { createProductCatalog } from '@/commerce/demo-catalog';
import { ProductPurchase } from '@/components/ecommerce/ProductPurchase';
import { Link } from '@/lib/I18nRouting';

type ProductPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

async function getCatalog() {
  const t = await getTranslations('Storefront');
  return createProductCatalog(t);
}

export async function generateMetadata(
  props: ProductPageProps,
): Promise<Metadata> {
  const { slug } = await props.params;
  const { products } = await getCatalog();
  const product = products.find((item) => item.slug === slug);
  return product
    ? { title: product.name, description: product.description }
    : {};
}

export default async function ProductPage(props: ProductPageProps) {
  const { locale, slug } = await props.params;
  const t = await getTranslations('Storefront');
  const { products } = await getCatalog();
  const product = products.find((item) => item.slug === slug);
  if (!product) {
    notFound();
  }

  setRequestLocale(locale);

  const [variant] = product.variants;
  if (!variant || product.media.length === 0) {
    notFound();
  }

  const localeCode = locale === 'es' ? 'es-AR' : 'en-US';

  return (
    <div className="space-y-8 py-8 sm:py-12">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('product.backToCatalog')}
      </Link>

      <ProductPurchase
        product={product}
        locale={localeCode}
        addToCartLabel={t('product.addToCart')}
        quantityLabel={t('product.quantity')}
        maxQuantity={variant.inventory.availableQuantity}
        stockLabel={t('product.stockAvailable', {
          count: variant.inventory.availableQuantity,
        })}
        sizeLabel={t('product.size')}
        selectSizeLabel={t('product.selectSize')}
        sizeRequiredLabel={t('product.sizeRequired')}
      />

      <section className="border-t border-border pt-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('product.detailsEyebrow')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {t('product.detailsTitle')}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              t('product.detailOne'),
              t('product.detailTwo'),
              t('product.detailThree'),
            ].map((detail) => (
              <p
                key={detail}
                className="rounded-2xl bg-muted/70 p-5 text-sm leading-6 text-muted-foreground"
              >
                {detail}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
