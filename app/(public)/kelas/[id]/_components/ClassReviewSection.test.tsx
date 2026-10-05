import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClassReviewSection, ClassReviewUnavailable, ReviewStars } from './ClassReviewSection';
import type { PublicReview } from '@/lib/reviews';

/**
 * Render test for the public class-review section (KEL-160).
 *
 * The section is server-rendered from `getClassReviews`: what is pinned is
 * the rendered contract a parent reads — the average summary, the review
 * list with its pagination links, the "Belum ada ulasan" empty state, and
 * that a hostile comment is escaped as text rather than executed as markup.
 * No DOM testing library is needed; the markup is the contract.
 */

const review = (overrides: Partial<PublicReview> = {}): PublicReview => ({
  rating: 5,
  comment: 'Kelasnya bagus, anak saya senang.',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...overrides,
});

const baseProps = {
  classId: 'class-1',
  average: 4.5,
  count: 12,
  page: 1,
  totalPages: 2,
};

describe('ClassReviewSection', () => {
  it('renders the average summary, the reviews, and the next-page link', () => {
    const html = renderToStaticMarkup(
      <ClassReviewSection {...baseProps} reviews={[review(), review({ rating: 4, comment: 'Lumayan.' })]} />
    );

    expect(html).toContain('Rating dan ulasan');
    expect(html).toContain('4,5');
    expect(html).toContain('12 ulasan');
    expect(html).toContain('Rating rata-rata 4,5 dari 5');
    expect(html).toContain('Kelasnya bagus, anak saya senang.');
    expect(html).toContain('Lumayan.');
    expect(html).toContain('href="/kelas/class-1?ulasan_page=2"');
    expect(html).toContain('Ulasan berikutnya');
    expect(html).not.toContain('Ulasan sebelumnya');
  });

  it('renders both pagination directions on a middle page', () => {
    const html = renderToStaticMarkup(
      <ClassReviewSection {...baseProps} page={2} totalPages={3} reviews={[review()]} />
    );

    expect(html).toContain('ulasan_page=1');
    expect(html).toContain('ulasan_page=3');
  });

  it('keeps the summary but shows the empty state when there are no reviews', () => {
    const html = renderToStaticMarkup(<ClassReviewSection {...baseProps} reviews={[]} />);

    expect(html).toContain('4,5');
    expect(html).toContain('Belum ada ulasan untuk kelas ini.');
  });

  it('hides the summary when the class has no average yet', () => {
    const html = renderToStaticMarkup(
      <ClassReviewSection {...baseProps} average={null} count={0} reviews={[]} />
    );

    expect(html).toContain('Rating dan ulasan');
    expect(html).toContain('Belum ada ulasan untuk kelas ini.');
    expect(html).not.toContain('ulasan)');
  });

  it('escapes a hostile comment as text rather than executing it as markup', () => {
    const html = renderToStaticMarkup(
      <ClassReviewSection
        {...baseProps}
        reviews={[review({ comment: '<script>alert(1)</script><img src=x onerror=alert(2)>' })]}
      />
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('labels an empty comment instead of rendering a blank review', () => {
    const html = renderToStaticMarkup(
      <ClassReviewSection {...baseProps} reviews={[review({ comment: '   ' })]} />
    );

    expect(html).toContain('Tanpa komentar tertulis.');
  });

  it('announces star values to screen readers instead of reading glyphs', () => {
    const html = renderToStaticMarkup(<ReviewStars rating={4} />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="4 dari 5 bintang"');
  });

  it('degrades to an inline notice when the review lookup fails', () => {
    const html = renderToStaticMarkup(<ClassReviewUnavailable />);

    expect(html).toContain('Rating dan ulasan');
    expect(html).toContain('Ulasan belum dapat dimuat');
  });
});
