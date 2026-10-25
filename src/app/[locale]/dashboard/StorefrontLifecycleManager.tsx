'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { closeStorefront, reopenStorefront } from './storefront-actions';

type LifecycleStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export default function StorefrontLifecycleManager({
  status,
  closedAt,
}: {
  status: LifecycleStatus;
  closedAt: string | null;
}) {
  const t = useTranslations('StorefrontLifecycle');
  const locale = useLocale();
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<'close' | 'reopen' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const isClosed = status === 'CLOSED';
  const isClosing = status === 'CLOSING';
  const closedDate = closedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
        new Date(closedAt),
      )
    : null;

  useEffect(() => {
    if (dialogMode) confirmButtonRef.current?.focus();
  }, [dialogMode]);

  function errorMessage(code: string) {
    if (code === 'PLAN_CHECKOUT_CANCEL_FAILED') return t('planCheckoutCancelFailed');
    if (code === 'PRO_PAYMENT_PENDING') return t('proChargeInProgress');
    if (code === 'CLOSURE_IN_PROGRESS') return t('closureInProgress');
    if (code === 'REOPEN_FAILED') return t('reopenFailed');
    return t('unexpectedError');
  }

  function confirmChange() {
    if (!dialogMode) return;
    const mode = dialogMode;
    setFeedback(null);

    startTransition(async () => {
      const result = mode === 'close' ? await closeStorefront() : await reopenStorefront();
      if (!result.ok) {
        setFeedback(errorMessage(result.code));
        return;
      }
      setDialogMode(null);
      setFeedback(null);
      router.refresh();
    });
  }

  const dialogTitle = dialogMode === 'close' ? t('closeDialogTitle') : t('reopenDialogTitle');
  const dialogDescription =
    dialogMode === 'close' ? t('closeDialogDescription') : t('reopenDialogDescription');

  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="storefront-lifecycle-title"
    >
      <div>
        <h2 id="storefront-lifecycle-title" className="text-xl font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isClosing
            ? t('closingStatus')
            : isClosed
              ? t('closedDescription')
              : t('openDescription')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-sm font-medium"
          aria-live="polite"
        >
          {isClosing ? t('closingStatus') : isClosed ? t('closedStatus') : t('openStatus')}
        </span>
        {isClosed && closedDate && (
          <p className="text-sm text-muted-foreground">{t('closedDate', { date: closedDate })}</p>
        )}
      </div>

      {feedback && (
        <p role="alert" className="rounded-xl border p-3 text-sm">
          {feedback}
        </p>
      )}

      <div>
        {isClosed ? (
          <Button
            type="button"
            variant="default"
            disabled={pending}
            onClick={() => setDialogMode('reopen')}
          >
            {t('reopenButton')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            disabled={pending || isClosing}
            onClick={() => {
              setFeedback(null);
              setDialogMode('close');
            }}
          >
            {isClosing ? t('closingStatus') : t('closeButton')}
          </Button>
        )}
      </div>

      {dialogMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="storefront-confirm-title"
            aria-describedby="storefront-confirm-description"
            className="my-auto w-full max-w-xl rounded-2xl border bg-background p-6 text-foreground shadow-2xl sm:p-8"
          >
            <h3 id="storefront-confirm-title" className="text-xl font-semibold">
              {dialogTitle}
            </h3>
            <p
              id="storefront-confirm-description"
              className="mt-3 text-sm leading-6 text-muted-foreground"
            >
              {dialogDescription}
            </p>
            {feedback && (
              <p role="alert" className="mt-4 rounded-xl border p-3 text-sm">
                {feedback}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setDialogMode(null);
                  setFeedback(null);
                }}
              >
                {t('cancel')}
              </Button>
              <Button
                ref={confirmButtonRef}
                type="button"
                variant={dialogMode === 'close' ? 'destructive' : 'default'}
                disabled={pending}
                onClick={confirmChange}
              >
                {pending
                  ? t('closingStatus')
                  : dialogMode === 'close'
                    ? t('confirmClose')
                    : t('confirmReopen')}
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
