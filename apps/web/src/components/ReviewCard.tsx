import type { Review } from '@bookshelf/shared';

/** One filled or outline star — inline SVG, same convention as SearchBar's icons. */
function Star({ filled }: { filled: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      className="size-4 text-accent"
    >
      <path
        d="M10 2.5l2.34 4.74 5.24.76-3.79 3.7.9 5.22L10 14.5l-4.69 2.42.9-5.22-3.79-3.7 5.24-.76z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ReviewCard({ review }: { review: Review }): React.JSX.Element {
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div aria-label={`${review.rating} out of 5 stars`} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} filled={index < review.rating} />
          ))}
        </div>
        <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink">{review.text}</p>
      <p className="mt-2 text-xs text-muted">— {review.userId}</p>
    </article>
  );
}
