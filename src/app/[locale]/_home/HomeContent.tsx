import { ArrowRight, Box, Globe2, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createProductCatalog } from '@/commerce/demo-catalog';
import { ProductGrid } from '@/components/ecommerce/ProductGrid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { Typography } from '@/components/ui/typography';
import { Link } from '@/lib/I18nRouting';

type HomeContentProps = {
  locale: string;
};

export async function HomeContent({ locale }: HomeContentProps) {
  const t = await getTranslations('Storefront');
  const { products, categories } = await createProductCatalog(t);

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
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground px-6 py-16 text-background sm:px-10 lg:px-16 lg:py-24">
        <div className="absolute top-[-20%] -right-20 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-10%] size-80 rounded-full bg-hero-accent/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <Typography as="p" variant="eyebrow" className="tracking-[0.22em] text-hero-accent">
            {t('home.eyebrow')}
          </Typography>
          <Typography as="h1" variant="display" className="mt-5 max-w-3xl">
            {t('home.title')}
          </Typography>
          <Typography variant="body" className="mt-6 max-w-2xl text-background/70 sm:text-lg">
            {t('home.description')}
          </Typography>
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
              className="border-background/20 bg-background/5 text-background hover:bg-background/10 hover:text-background"
            >
              <Link href="/about">{t('home.secondaryCta')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={t('home.categoriesEyebrow')}
          title={t('home.categoriesTitle')}
          description={t('home.categoriesDescription')}
          action={
            <Link
              href="/products"
              className="text-sm font-medium hover:text-primary hover:underline"
            >
              {t('home.viewAll')}
            </Link>
          }
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="group rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Card variant="interactive" padding="lg" className="h-full gap-0">
                <div className="grid size-10 place-items-center rounded-xl bg-muted text-sm font-semibold">
                  0{index + 1}
                </div>
                <Typography as="h3" variant="cardTitle" className="mt-5">
                  {category.name}
                </Typography>
                <Typography variant="muted" className="mt-2">
                  {categoryDescriptions[index]}
                </Typography>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
                  {t('home.explore')}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow={t('home.featuredEyebrow')}
          title={t('home.featuredTitle')}
          action={
            <Link
              href="/products"
              className="text-sm font-medium hover:text-primary hover:underline"
            >
              {t('home.browseCatalog')}
            </Link>
          }
        />
        <div className="mt-8">
          <ProductGrid
            products={products.slice(0, 4)}
            locale={locale === 'es' ? 'es-AR' : 'en-US'}
            outOfStockLabel={t('catalog.outOfStock')}
          />
        </div>
      </section>

      <Card as="section" variant="flat" padding="lg" className="rounded-[2rem] bg-card sm:p-10">
        <SectionHeading
          eyebrow={t('home.benefitsEyebrow')}
          title={t('home.benefitsTitle')}
          level="h2"
          contentClassName="max-w-2xl"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ Icon, title, description }) => (
            <Card key={title} variant="flat" padding="default" className="gap-0 bg-background">
              <Icon className="size-5" aria-hidden="true" />
              <Typography as="h3" variant="cardTitle" className="mt-4">
                {title}
              </Typography>
              <Typography variant="muted" className="mt-2">
                {description}
              </Typography>
            </Card>
          ))}
        </div>
      </Card>

      <section className="rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeading
            eyebrow={t('home.ctaEyebrow')}
            title={t('home.ctaTitle')}
            description={t('home.ctaDescription')}
            level="h2"
            contentClassName="max-w-2xl"
            action={
              <Button asChild size="lg">
                <Link href="/products">
                  {t('home.ctaButton')} <Truck className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </div>
      </section>
    </div>
  );
}
