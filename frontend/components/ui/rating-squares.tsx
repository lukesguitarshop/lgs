import { cn } from '@/lib/utils';

interface RatingSquaresProps {
  /** 0–5. Fractions round to the nearest whole square. */
  rating: number;
  /** `md` is the 12px summary size, `sm` the 10px size used inside review cards. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Five crimson squares standing in for star ratings. A filled square is a rated point;
 * an empty one is a 1.5px crimson outline. Same read as stars, no yellow — the palette
 * has exactly four colours and this keeps it that way.
 */
export function RatingSquares({ rating, size = 'md', className }: RatingSquaresProps) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  const box = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  return (
    <div
      role="img"
      aria-label={`${rating} out of 5`}
      className={cn('flex gap-[3px]', className)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'block',
            box,
            i < filled ? 'bg-primary' : 'border-[1.5px] border-primary'
          )}
        />
      ))}
    </div>
  );
}
