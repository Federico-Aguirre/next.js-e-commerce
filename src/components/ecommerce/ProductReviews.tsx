'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from '@/lib/I18nRouting';
import { RatingStars } from './RatingStars';

export type ProductReviewView = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string | null;
};

type ProductReviewLabels = {
  title: string;
  noReviews: string;
  empty: string;
  opinion: string;
  opinions: string;
  verifiedBuyer: string;
  signInRequired: string;
  deliveryRequired: string;
  alreadyReviewed: string;
  ratingLabel: string;
  star: string;
  commentLabel: string;
  commentPlaceholder: string;
  submit: string;
  submitting: string;
  submitted: string;
  submitError: string;
  ratingRequired: string;
  signIn: string;
  invalidReview: string;
};

type ProductReviewsProps = {
  productId: number;
  locale: string;
  ratingAverage: number;
  ratingCount: number;
  reviews: ProductReviewView[];
  isSignedIn: boolean;
  canReview: boolean;
  hasReviewed: boolean;
  signInHref: string;
  labels: ProductReviewLabels;
};

export function ProductReviews({
  productId,
  locale,
  ratingAverage,
  ratingCount,
  reviews,
  isSignedIn,
  canReview,
  hasReviewed,
  signInHref,
  labels,
}: ProductReviewsProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const dateLocale = locale === 'es' ? 'es-AR' : 'en-US';
  const formattedAverage = new Intl.NumberFormat(dateLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratingAverage);
  const formattedCount = new Intl.NumberFormat(dateLocale).format(ratingCount);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      setMessage(labels.ratingRequired);
      setMessageIsError(true);
      return;
    }

    setSubmitting(true);
    setMessage('');
    setMessageIsError(false);

    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        errorCode?: string;
      };

      if (!response.ok) {
        const errors: Record<string, string> = {
          AUTH_REQUIRED: labels.signInRequired,
          DELIVERY_REQUIRED: labels.deliveryRequired,
          ALREADY_REVIEWED: labels.alreadyReviewed,
          INVALID_REVIEW: labels.invalidReview,
        };
        setMessage(errors[result.errorCode ?? ''] ?? labels.submitError);
        setMessageIsError(true);
        return;
      }

      setMessage(labels.submitted);
      setMessageIsError(false);
      setRating(0);
      setComment('');
      router.refresh();
    } catch {
      setMessage(labels.submitError);
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="border-border space-y-6 border-t pt-10"
      aria-labelledby="product-reviews-title"
    >
      <div>
        <h2 id="product-reviews-title" className="text-2xl font-semibold tracking-tight">
          {labels.title}
        </h2>
        {ratingCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold tabular-nums">{formattedAverage}</span>
            <RatingStars rating={ratingAverage} size={19} />
            <span className="text-sm text-muted-foreground">
              ({formattedCount}) {ratingCount === 1 ? labels.opinion : labels.opinions}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{labels.noReviews}</p>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-2xl border">
          {reviews.map((review) => {
            const authorName = review.authorName?.trim().split(/\s+/)[0];
            const reviewDate = new Intl.DateTimeFormat(dateLocale, {
              dateStyle: 'medium',
            }).format(new Date(review.createdAt));

            return (
              <article key={review.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate text-sm font-medium">
                      {authorName || labels.verifiedBuyer}
                    </span>
                    {authorName ? (
                      <span className="text-xs text-muted-foreground">{labels.verifiedBuyer}</span>
                    ) : null}
                  </div>
                  <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                    {reviewDate}
                  </time>
                </div>
                <div className="flex items-center gap-2">
                  <RatingStars rating={review.rating} />
                  <span className="sr-only">{review.rating}/5</span>
                </div>
                {review.comment ? (
                  <p className="text-sm leading-6 break-words whitespace-pre-wrap">
                    {review.comment}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <div className="border-border rounded-2xl border bg-muted/30 p-5 sm:p-6">
        {hasReviewed ? (
          <p className="text-sm text-muted-foreground">{labels.alreadyReviewed}</p>
        ) : canReview ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">{labels.ratingLabel}</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected = value <= rating;

                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} ${labels.star}`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="cursor-pointer rounded p-1 text-amber-500 transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Star size={27} strokeWidth={1.8} fill={selected ? 'currentColor' : 'none'} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="product-review-comment" className="mb-2 block text-sm font-medium">
                {labels.commentLabel}
              </label>
              <textarea
                id="product-review-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={labels.commentPlaceholder}
                className="border-border w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>

            {message ? (
              <p
                role="status"
                className={`text-sm ${messageIsError ? 'text-red-600' : 'text-green-700'}`}
              >
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? labels.submitting : labels.submit}
            </button>
          </form>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {isSignedIn ? (
              labels.deliveryRequired
            ) : (
              <>
                {labels.signInRequired}{' '}
                <Link
                  href={signInHref}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {labels.signIn}
                </Link>
              </>
            )}
          </p>
        )}
        {message && !canReview && !hasReviewed ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
