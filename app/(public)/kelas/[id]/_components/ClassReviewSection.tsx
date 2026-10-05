import Link from 'next/link';
import { formatRatingAverage, formatReviewDate, type PublicReview } from '@/lib/reviews';

/**
 * Accessible star display for a `PublicReview` rating (KEL-160).
 *
 * The value is display-only: a `role="img"` with an Indonesian label so a
 * screen reader announces "4 dari 5 bintang" instead of reading five glyphs.
 */
export function ReviewStars({ rating, label }: { rating: number; label?: string }) {
  const text = label ?? `${rating} dari 5 bintang`;
  return (
    <span role="img" aria-label={text}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true" className={star <= rating ? 'text-[#b7791f]' : 'text-[#c8d0c5]'}>
          ★
        </span>
      ))}
    </span>
  );
}

function renderRatingSummary(average: number | null | undefined, count: number | undefined) {
  if (typeof average !== 'number' || !Number.isFinite(average)) return null;
  const total = typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : 0;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-lg font-bold" aria-label={`Rating rata-rata ${formatRatingAverage(average)} dari 5, berdasarkan ${total} ulasan`}>
      <ReviewStars rating={Math.round(average)} label={`Rating rata-rata ${formatRatingAverage(average)} dari 5`} />
      <span>{formatRatingAverage(average)}</span>
      <span className="text-sm font-semibold text-[#52615b]">({total} ulasan)</span>
    </p>
  );
}

function ReviewItem({ review }: { review: PublicReview }) {
  const date = formatReviewDate(review.created_at);
  return (
    <li className="rounded-2xl border border-[#e5e8df] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReviewStars rating={review.rating} />
        {date && (
          <time dateTime={review.created_at} className="text-sm text-[#65726c]">
            {date}
          </time>
        )}
      </div>
      {review.comment.trim() ? (
        // React escapes this text by construction; never render it as HTML.
        <p className="mt-3 leading-7 text-[#17231f]">{review.comment}</p>
      ) : (
        <p className="mt-3 text-sm text-[#65726c]">Tanpa komentar tertulis.</p>
      )}
    </li>
  );
}

export type ClassReviewSectionProps = {
  classId: string;
  average: number | null | undefined;
  count: number | undefined;
  reviews: PublicReview[];
  page: number;
  totalPages: number;
};

/**
 * Rating summary plus the first page of public class reviews (KEL-160).
 *
 * Server-rendered from `getClassReviews`: a class without reviews keeps the
 * "Belum ada ulasan" empty state, and a failed review lookup degrades to an
 * inline notice so the class detail itself never breaks.
 */
export function ClassReviewSection({ classId, average, count, reviews, page, totalPages }: ClassReviewSectionProps) {
  const pageLink = (next: number) => `/kelas/${encodeURIComponent(classId)}?ulasan_page=${next}`;
  return (
    <section className="mt-10 border-t border-[#e5e8df] pt-7" aria-label="Rating dan ulasan">
      <h2 className="text-xl font-black">Rating dan ulasan</h2>
      {renderRatingSummary(average, count)}
      {reviews.length ? (
        <>
          <ul className="mt-5 space-y-4">
            {reviews.map((review, index) => (
              <ReviewItem key={`${review.created_at}-${review.updated_at}-${review.rating}-${index}`} review={review} />
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="mt-6 flex justify-between" aria-label="Halaman ulasan">
              {page > 1 ? (
                <Link className="font-bold underline" href={pageLink(page - 1)}>
                  ← Ulasan sebelumnya
                </Link>
              ) : (
                <span />
              )}
              {page < totalPages && (
                <Link className="font-bold underline" href={pageLink(page + 1)}>
                  Ulasan berikutnya →
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <p className="mt-4 text-[#52615b]">Belum ada ulasan untuk kelas ini.</p>
      )}
    </section>
  );
}

export function ClassReviewUnavailable() {
  return (
    <section className="mt-10 border-t border-[#e5e8df] pt-7" aria-label="Rating dan ulasan">
      <h2 className="text-xl font-black">Rating dan ulasan</h2>
      <p className="mt-4 text-[#52615b]">Ulasan belum dapat dimuat. Coba muat ulang beberapa saat lagi.</p>
    </section>
  );
}
