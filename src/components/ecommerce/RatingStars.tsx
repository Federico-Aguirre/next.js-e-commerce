import { Star } from 'lucide-react';

type RatingStarsProps = {
  rating: number;
  size?: number;
};

export function RatingStars({ rating, size = 16 }: RatingStarsProps) {
  const percentage = Math.min(100, Math.max(0, (rating / 5) * 100));

  return (
    <span className="relative inline-flex shrink-0 leading-none" aria-hidden="true">
      <span className="flex text-amber-400/35">
        {Array.from({ length: 5 }, (_, index) => (
          <Star key={index} size={size} strokeWidth={1.8} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex overflow-hidden whitespace-nowrap text-amber-400"
        style={{ width: `${percentage}%` }}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Star key={index} size={size} strokeWidth={1.8} fill="currentColor" />
        ))}
      </span>
    </span>
  );
}
