import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { CatalogProduct } from '@/commerce/catalog-domain';
import { createProductCatalog } from '@/commerce/demo-catalog';
import { CatalogFilters } from '@/components/ecommerce/CatalogFilters';
import { Pagination } from '@/components/ecommerce/Pagination';
import { ProductGrid } from '@/components/ecommerce/ProductGrid';
import { StorefrontState } from '@/components/ecommerce/StorefrontStates';

type ProductsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pageSize = 6;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function filterAndSort(
  products: readonly CatalogProduct[],
  searchParams: Record<string, string | string[] | undefined>,
) {
  const q = firstParam(searchParams.q)?.trim().toLowerCase();
  const category = firstParam(searchParams.category);
  const availability = firstParam(searchParams.availability);
  const color = firstParam(searchParams.color);
  const size = firstParam(searchParams.size);
  const brand = firstParam(searchParams.brand);
  const gender = firstParam(searchParams.gender);
  const material = firstParam(searchParams.material);
  const sort = firstParam(searchParams.sort) ?? 'featured';

  const filtered = products.filter((product) => {
    const categoryMatch =
      !category || product.categories.some((item) => item.slug === category);

    const searchMatch =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q);

    const stockMatch =
      availability !== 'in-stock' ||
      product.variants.some((variant) => variant.available);

    const colorMatch =
      !color ||
      product.variants.some((variant) => variant.optionValues.color === color);

    const sizeMatch =
      !size || product.variants.some((variant) => variant.sizeStock?.[size]);

    const brandMatch = !brand || product.brand === brand;

    const genderMatch = !gender || product.gender === gender;

    const materialMatch = !material || product.material === material;

    return (
      categoryMatch &&
      searchMatch &&
      stockMatch &&
      colorMatch &&
      sizeMatch &&
      brandMatch &&
      genderMatch &&
      materialMatch
    );
  });

  return filtered.toSorted((a, b) => {
    const aPrice = a.variants[0]?.price.amount ?? 0;
    const bPrice = b.variants[0]?.price.amount ?? 0;

    switch (sort) {
      case 'price-asc': {
        return aPrice - bPrice;
      }

      case 'price-desc': {
        return bPrice - aPrice;
      }

      case 'name-asc': {
        return a.name.localeCompare(b.name);
      }

      case 'rating-desc': {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }

      default: {
        return 0;
      }
    }
  });
}

export async function generateMetadata() {
  const t = await getTranslations('Storefront.catalog');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ProductsPage(props: ProductsPageProps) {
  const { locale } = await props.params;
  const rawSearchParams = await props.searchParams;

  const t = await getTranslations('Storefront.catalog');
  const homeT = await getTranslations('Storefront');

  setRequestLocale(locale);

  const { products, categories } = createProductCatalog(homeT);

  const productsPath = locale === 'en' ? '/products' : `/${locale}/products`;

  const filtered = filterAndSort(products, rawSearchParams);

  const page = Math.max(1, Number(firstParam(rawSearchParams.page)) || 1);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  const safePage = Math.min(page, pageCount);

  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const query: Record<string, string | undefined> = {
    q: firstParam(rawSearchParams.q),
    category: firstParam(rawSearchParams.category),
    availability: firstParam(rawSearchParams.availability),
    color: firstParam(rawSearchParams.color),
    size: firstParam(rawSearchParams.size),
    brand: firstParam(rawSearchParams.brand),
    gender: firstParam(rawSearchParams.gender),
    material: firstParam(rawSearchParams.material),
    sort: firstParam(rawSearchParams.sort),
  };

  return (
    <div className="space-y-10 py-8 sm:py-12">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t('eyebrow')}
        </p>

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {t('title')}
            </h1>

            <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
              {t('description')}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('resultCount', { count: filtered.length })}
          </p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(180px,20%)_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <CatalogFilters
            categories={categories}
            searchParams={query}
            options={{
              colors: [
                ...new Map(
                  products.flatMap((product) =>
                    product.variants.map((variant) => [
                      variant.optionValues.color,
                      {
                        id: variant.optionValues.color,
                        name: variant.name,
                      },
                    ]),
                  ),
                ).values(),
              ],

              sizes: [
                ...new Set(
                  products.flatMap((product) =>
                    product.variants.flatMap((variant) =>
                      Object.keys(variant.sizeStock ?? {}),
                    ),
                  ),
                ),
              ],

              brands: [
                ...new Set(
                  products
                    .map((product) => product.brand)
                    .filter((value): value is string => Boolean(value)),
                ),
              ],

              genders: [
                ...new Set(
                  products
                    .map((product) => product.gender)
                    .filter(
                      (value): value is NonNullable<CatalogProduct['gender']> =>
                        value !== undefined,
                    ),
                ),
              ],

              materials: [
                ...new Set(
                  products
                    .map((product) => product.material)
                    .filter((value): value is string => Boolean(value)),
                ),
              ],
            }}
          />
        </aside>

        <div className="min-w-0">
          {filtered.length === 0 ? (
            <StorefrontState kind="empty" />
          ) : (
            <>
              <ProductGrid
                products={visible}
                locale={locale === 'es' ? 'es-AR' : 'en-US'}
                outOfStockLabel={t('outOfStock')}
              />

              <Pagination
                page={safePage}
                pageCount={pageCount}
                query={query}
                previousLabel={t('previous')}
                nextLabel={t('next')}
                navigationLabel={t('paginationLabel')}
                basePath={productsPath}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
