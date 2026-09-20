import { describe, expect, it } from 'vitest';
import {
  classPublicationActionLabel,
  classPublicationNextValue,
  classPublicationPresentation,
  enrollmentStatusPresentation,
  isClassPublished,
  normalizeEnrollmentStatus,
} from './class-publication';

describe('isClassPublished', () => {
  it('is true only when the backend explicitly says true', () => {
    expect(isClassPublished({ is_published: true })).toBe(true);
    expect(isClassPublished({ is_published: false })).toBe(false);
  });

  it('treats missing, null and undefined flags as unpublished', () => {
    expect(isClassPublished({})).toBe(false);
    expect(isClassPublished({ is_published: null })).toBe(false);
    expect(isClassPublished(null)).toBe(false);
    expect(isClassPublished(undefined)).toBe(false);
  });
});

describe('normalizeEnrollmentStatus', () => {
  it('accepts the four statuses supported by the academic service', () => {
    expect(normalizeEnrollmentStatus('open')).toBe('open');
    expect(normalizeEnrollmentStatus('closed')).toBe('closed');
    expect(normalizeEnrollmentStatus('full')).toBe('full');
    expect(normalizeEnrollmentStatus('archived')).toBe('archived');
  });

  it('rejects unknown values and non-strings', () => {
    expect(normalizeEnrollmentStatus('OPEN')).toBeNull();
    expect(normalizeEnrollmentStatus('pending')).toBeNull();
    expect(normalizeEnrollmentStatus(undefined)).toBeNull();
    expect(normalizeEnrollmentStatus(7)).toBeNull();
  });
});

describe('enrollmentStatusPresentation', () => {
  it('marks open as the success tone that makes a class enrollable', () => {
    expect(enrollmentStatusPresentation('open')).toEqual({
      label: 'Open for enrollment',
      tone: 'success',
    });
  });

  it('marks full as a warning and closed/archived as neutral', () => {
    expect(enrollmentStatusPresentation('full').tone).toBe('warning');
    expect(enrollmentStatusPresentation('closed').tone).toBe('neutral');
    expect(enrollmentStatusPresentation('archived').tone).toBe('neutral');
  });

  it('labels an unrecognised status without inventing a tone', () => {
    expect(enrollmentStatusPresentation('mystery')).toEqual({
      label: 'Unknown enrollment status',
      tone: 'neutral',
    });
  });
});

describe('classPublicationPresentation', () => {
  it('treats a published and open class as visible in /kelas', () => {
    const result = classPublicationPresentation({
      is_published: true,
      enrollment_status: 'open',
    });

    expect(result.label).toBe('Published');
    expect(result.tone).toBe('success');
    expect(result.enrollmentLabel).toBe('Open for enrollment');
    expect(result.detail).toBe('Visible in /kelas and open for enrollment.');
  });

  it('keeps a published but closed class visible without being enrollable', () => {
    const result = classPublicationPresentation({
      is_published: true,
      enrollment_status: 'closed',
    });

    expect(result.label).toBe('Published');
    expect(result.detail).toBe('Visible in /kelas but not open for enrollment.');
  });

  it('reports an unpublished class as hidden from /kelas', () => {
    const result = classPublicationPresentation({
      is_published: false,
      enrollment_status: 'open',
    });

    expect(result.label).toBe('Draft');
    expect(result.tone).toBe('warning');
    expect(result.detail).toBe('Hidden from /kelas until it is published.');
  });

  it('falls back to draft when the publication flag is absent', () => {
    expect(classPublicationPresentation({}).label).toBe('Draft');
    expect(classPublicationPresentation(null).label).toBe('Draft');
  });
});

describe('publication action helpers', () => {
  it('offers Publish for a draft and Unpublish for a published class', () => {
    expect(classPublicationActionLabel({ is_published: false })).toBe('Publish');
    expect(classPublicationActionLabel({ is_published: true })).toBe('Unpublish');
    expect(classPublicationActionLabel({})).toBe('Publish');
  });

  it('sends the opposite of the current publication state', () => {
    expect(classPublicationNextValue({ is_published: false })).toBe(true);
    expect(classPublicationNextValue({ is_published: true })).toBe(false);
    expect(classPublicationNextValue({})).toBe(true);
  });
});
