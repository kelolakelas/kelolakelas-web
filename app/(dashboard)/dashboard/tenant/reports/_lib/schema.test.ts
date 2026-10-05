import { describe, expect, it } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';
import {
  isReportUuid,
  isValidReportDate,
  isValidScoreInput,
  normalizeTenantReport,
  parseReportFilters,
  reportCountLabel,
  reportCreatePayload,
  reportDateLabel,
  reportFormSchema,
  reportQueryString,
  reportScoreLabel,
  reportUpdateFormSchema,
  reportUpdatePayload,
  reportWritePermissions,
} from './schema';

/**
 * Unit tests for the report schema, filters, and pure helpers (KEL-139).
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * an empty title is rejected, a score outside 0–100 is rejected while an
 * empty score stays valid ("belum dinilai"), the list query only carries
 * the vocabulary the academic `parseReportQuery` understands, and the
 * write dialogs stay hidden without their own `report:*` permission.
 */

const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';
const REPORT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function pagination(totalItems: number): ListPagination {
  return { page: 1, page_size: 20, total_items: totalItems, total_pages: 1 };
}

describe('reportFormSchema', () => {
  it('accepts a valid form with an optional score', () => {
    const parsed = reportFormSchema.safeParse({
      enrollment_id: ENROLLMENT_ID,
      title: 'Evaluasi tengah semester',
      evaluation_notes: 'Perkembangan baik.',
      score: '85',
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts an empty score as "belum dinilai"', () => {
    const parsed = reportFormSchema.safeParse({
      enrollment_id: ENROLLMENT_ID,
      title: 'Evaluasi tengah semester',
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const parsed = reportFormSchema.safeParse({
      enrollment_id: ENROLLMENT_ID,
      title: '   ',
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/Judul/);
    }
  });

  it('rejects scores outside 0–100', () => {
    for (const score of ['-1', '101', 'abc', '85%']) {
      const parsed = reportFormSchema.safeParse({
        enrollment_id: ENROLLMENT_ID,
        title: 'Evaluasi',
        evaluation_notes: '',
        score,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toMatch(/Skor/);
      }
    }
  });

  it('rejects a non-UUID enrollment identifier', () => {
    const parsed = reportFormSchema.safeParse({
      enrollment_id: 'siswa-1',
      title: 'Evaluasi',
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a title longer than 255 characters', () => {
    const parsed = reportFormSchema.safeParse({
      enrollment_id: ENROLLMENT_ID,
      title: 'a'.repeat(256),
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('reportUpdateFormSchema', () => {
  it('accepts a valid update without an enrollment', () => {
    const parsed = reportUpdateFormSchema.safeParse({
      report_id: REPORT_ID,
      title: 'Evaluasi revisi',
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid report id', () => {
    const parsed = reportUpdateFormSchema.safeParse({
      report_id: 'laporan-1',
      title: 'Evaluasi revisi',
      evaluation_notes: '',
      score: '',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('report payloads', () => {
  it('builds the exact create body the backend binds', () => {
    expect(
      reportCreatePayload({
        enrollment_id: ENROLLMENT_ID,
        title: 'Evaluasi',
        evaluation_notes: 'Catatan.',
        score: '85',
      })
    ).toEqual({
      enrollment_id: ENROLLMENT_ID,
      title: 'Evaluasi',
      evaluation_notes: 'Catatan.',
      score: 85,
    });
  });

  it('omits empty optional fields from the create body', () => {
    expect(
      reportCreatePayload({ enrollment_id: ENROLLMENT_ID, title: 'Evaluasi', evaluation_notes: '', score: '' })
    ).toEqual({ enrollment_id: ENROLLMENT_ID, title: 'Evaluasi' });
  });

  it('builds the exact update body with no enrollment field', () => {
    const body = reportUpdatePayload({
      report_id: REPORT_ID,
      title: 'Evaluasi revisi',
      evaluation_notes: 'Catatan.',
      score: '90',
    });

    expect(body).toEqual({ title: 'Evaluasi revisi', evaluation_notes: 'Catatan.', score: 90 });
    expect(body).not.toHaveProperty('enrollment_id');
  });
});

describe('parseReportFilters', () => {
  it('parses a full filter state', () => {
    const result = parseReportFilters({
      page: '2',
      search: 'evaluasi',
      enrollment_id: ENROLLMENT_ID,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    });

    expect(result).toEqual({
      filters: {
        page: 2,
        search: 'evaluasi',
        enrollment_id: ENROLLMENT_ID,
        date_from: '2026-09-01',
        date_to: '2026-09-30',
      },
      error: null,
    });
  });

  it('keeps defaults for an empty visit', () => {
    const result = parseReportFilters({});

    expect(result.error).toBeNull();
    expect(result.filters).toMatchObject({ page: 1, search: '', enrollment_id: '' });
  });

  it('rejects a non-UUID enrollment, a malformed date, and an inverted range', () => {
    expect(parseReportFilters({ enrollment_id: 'siswa-1' }).error).toBe('invalid_filter');
    expect(parseReportFilters({ date_from: '30-09-2026' }).error).toBe('invalid_filter');
    expect(parseReportFilters({ date_from: '2026-02-30' }).error).toBe('invalid_filter');
    expect(
      parseReportFilters({ date_from: '2026-10-01', date_to: '2026-09-01' }).error
    ).toBe('invalid_filter');
    expect(parseReportFilters({ page: '0' }).error).toBe('invalid_filter');
  });
});

describe('reportQueryString', () => {
  it('only carries the vocabulary the backend understands', () => {
    const query = reportQueryString({
      page: 2,
      search: 'evaluasi',
      enrollment_id: ENROLLMENT_ID,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    });

    const params = new URLSearchParams(query);

    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('20');
    expect(params.get('search')).toBe('evaluasi');
    expect(params.get('enrollment_id')).toBe(ENROLLMENT_ID);
    expect(params.get('date_from')).toBe('2026-09-01');
    expect(params.get('date_to')).toBe('2026-09-30');
    expect(params.has('class_id')).toBe(false);
  });
});

describe('normalizeTenantReport', () => {
  it('normalizes a full row with its preloaded enrollment', () => {
    const report = normalizeTenantReport({
      id: REPORT_ID,
      enrollment_id: ENROLLMENT_ID,
      reporter_id: 'reporter-1',
      title: 'Evaluasi',
      evaluation_notes: 'Baik.',
      score: 85,
      created_at: '2026-09-30T10:00:00Z',
      enrollment: {
        id: ENROLLMENT_ID,
        student: { first_name: 'Budi', last_name: 'Santoso' },
        class: { id: 'class-1', name: 'Matematika Dasar' },
      },
    });

    expect(report?.title).toBe('Evaluasi');
    expect(report?.score).toBe(85);
    expect(report?.enrollment?.student?.first_name).toBe('Budi');
    expect(report?.enrollment?.class?.name).toBe('Matematika Dasar');
  });

  it('skips rows without a usable id and falls back on blank titles', () => {
    expect(normalizeTenantReport({ title: 'Tanpa id' })).toBeNull();
    expect(normalizeTenantReport({ id: REPORT_ID, title: '   ' })?.title).toBe('Laporan');
    expect(
      normalizeTenantReport({ id: REPORT_ID, title: 'Evaluasi', score: 'bagus' })?.score
    ).toBeUndefined();
  });
});

describe('report helpers', () => {
  it('validates uuids, dates, and score inputs', () => {
    expect(isReportUuid(ENROLLMENT_ID)).toBe(true);
    expect(isReportUuid('siswa-1')).toBe(false);
    expect(isValidReportDate('2026-09-30')).toBe(true);
    expect(isValidReportDate('2026-02-30')).toBe(false);
    expect(isValidScoreInput('')).toBe(true);
    expect(isValidScoreInput('100')).toBe(true);
    expect(isValidScoreInput('101')).toBe(false);
  });

  it('labels dates, scores, and counts for an Indonesian reader', () => {
    expect(reportDateLabel('2026-09-30T10:00:00Z')).toContain('2026');
    expect(reportDateLabel(null)).toBe('—');
    expect(reportScoreLabel(85)).toContain('85');
    expect(reportScoreLabel(null)).toBe('Belum dinilai');
    expect(reportCountLabel(pagination(1))).toBe('1 laporan');
    expect(reportCountLabel(pagination(3))).toBe('3 laporan');
  });
});

describe('reportWritePermissions', () => {
  it('grants each action only on its own permission', () => {
    expect(
      reportWritePermissions({ state: 'ok', membership: { permissions: ['report:create'] } })
    ).toEqual({ canCreate: true, canUpdate: false, canDelete: false });
    expect(
      reportWritePermissions({
        state: 'ok',
        membership: { permissions: ['report:create', 'report:update', 'report:delete'] },
      })
    ).toEqual({ canCreate: true, canUpdate: true, canDelete: true });
  });

  it('is fail-closed when the membership cannot be read', () => {
    for (const nav of [
      { state: 'forbidden', membership: null },
      { state: 'ok', membership: null },
    ] as const) {
      expect(reportWritePermissions(nav)).toEqual({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      });
    }
  });
});
