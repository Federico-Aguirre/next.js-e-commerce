import {
  ArrowRight,
  Box,
  Globe2,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { createProductCatalog } from '@/commerce/demo-catalog';
import { ProductGrid } from '@/components/ecommerce/ProductGrid';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/I18nRouting';

type HomeContentProps = {
  locale: string;
};

export async function HomeContent({ locale }: HomeContentProps) {
  const t = await getTranslations('Storefront');

  const { products, categories } = createProductCatalog(t);

  const categoryDescriptions = [
    t('products.jacket.description'),
    t('products.pants.description'),
    t('products.shoes.description'),
    t('products.sweatshirt.description'),
    t('products.tshirt.description'),
  ];

  const benefits: { Icon: LucideIcon; title: string; description: string }[] = [
    {
      Icon: Sparkles,
      title: t('home.benefit1Title'),
      description: t('home.benefit1Description'),
    },
    {
      Icon: Box,
      title: t('home.benefit2Title'),
      description: t('home.benefit2Description'),
    },
    {
      Icon: Globe2,
      title: t('home.benefit3Title'),
      description: t('home.benefit3Description'),
    },
    {
      Icon: ShieldCheck,
      title: t('home.benefit4Title'),
      description: t('home.benefit4Description'),
    },
  ];

  return (
    <div className="space-y-20 py-6 sm:py-10 lg:space-y-28">
      <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-zinc-950 px-6 py-16 text-white dark:border-white/10 sm:px-10 lg:px-16 lg:py-24">
        <div className="absolute -right-20 top-[-20%] size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-10%] size-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            {t('home.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            {t('home.description')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/products">
                {t('home.primaryCta')}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/about">{t('home.secondaryCta')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('home.categoriesEyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              {t('home.categoriesTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t('home.categoriesDescription')}
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium hover:underline"
          >
            {t('home.viewAll')}
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-muted text-sm font-semibold">
                0{index + 1}
              </div>
              <h3 className="mt-5 font-semibold">{category.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {categoryDescriptions[index]}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
                {t('home.explore')}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('home.featuredEyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              {t('home.featuredTitle')}
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium hover:underline"
          >
            {t('home.browseCatalog')}
          </Link>
        </div>
        <div className="mt-8">
          <ProductGrid
            products={products.slice(0, 4)}
            locale={locale === 'es' ? 'es-AR' : 'en-US'}
            outOfStockLabel={t('catalog.outOfStock')}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-muted/50 p-6 sm:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t('home.benefitsEyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('home.benefitsTitle')}
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ Icon, title, description }) => (
            <div key={title} className="rounded-2xl bg-background p-5">
              <Icon className="size-5" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('home.ctaEyebrow')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {t('home.ctaTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('home.ctaDescription')}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/products">
              {t('home.ctaButton')}{' '}
              <Truck className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
