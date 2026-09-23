import { AlertCircle, PackageSearch } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

type StorefrontStateProps = {
  kind: 'empty' | 'error';
};

export async function StorefrontState({ kind }: StorefrontStateProps) {
  const t = await getTranslations('Storefront.catalog');
  const isError = kind === 'error';

  return (
    <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
        {isError ? (
          <AlertCircle
            className="size-5 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
        ) : (
          <PackageSearch
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <h2 className="mt-5 text-lg font-semibold">
        {isError ? t('errorTitle') : t('emptyTitle')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {isError ? t('errorDescription') : t('emptyDescription')}
      </p>
    </div>
  );
}
