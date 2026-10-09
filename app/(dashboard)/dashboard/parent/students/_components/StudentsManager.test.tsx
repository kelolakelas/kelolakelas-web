import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { studentToday, type Student } from '@/lib/students';
import { StudentForm } from './StudentForm';
import { StudentsManager } from './StudentsManager';

/**
 * Render test for the parent student page (KEL-43).
 *
 * The academic service now serialises the surname as `last_name`; a build
 * released before that fix answered `lastå_name`. The page must show the
 * surname from either payload during the rollout, prefer the corrected key, and
 * never leak the legacy key name into the markup.
 */

const PARENT_ID = '123e4567-e89b-12d3-a456-426614174000';

function student(overrides: Partial<Student>): Student {
  return { id: 'student-1', parent_id: PARENT_ID, first_name: 'Alya', date_of_birth: '2018-02-03T00:00:00Z', ...overrides };
}

function renderList(items: Student[]): string {
  return renderToStaticMarkup(<StudentsManager data={{ items }} />);
}

function lastNameInputValue(html: string): string | undefined {
  const input = html.match(/<input[^>]*id="last_name"[^>]*>/)?.[0];
  return input?.match(/value="([^"]*)"/)?.[1];
}

describe('StudentsManager', () => {
  it('shows the full name from the corrected last_name key', () => {
    const html = renderList([student({ last_name: 'Zamani' })]);

    expect(html).toContain('Alya Zamani');
    expect(html).not.toContain('lastå_name');
  });

  it('still shows the surname a pre-KEL-43 academic build returns', () => {
    const html = renderList([student({ ['lastå_name']: 'Zamani' })]);

    expect(html).toContain('Alya Zamani');
  });

  it('prefers last_name when a payload carries both keys', () => {
    const html = renderList([student({ last_name: 'Zamani', ['lastå_name']: 'Salah' })]);

    expect(html).toContain('Alya Zamani');
    expect(html).not.toContain('Salah');
  });

  it('renders only the first name when the student has no surname', () => {
    const html = renderList([student({ last_name: null })]);

    expect(html).toMatch(/<h2[^>]*>Alya<\/h2>/);
  });

  it('renders the empty state when the parent has no students', () => {
    expect(renderList([])).toContain('Belum ada profil student.');
  });
});

describe('StudentForm', () => {
  it('limits the birth date to today in both create and edit forms', () => {
    for (const profile of [undefined, student({})]) {
      const html = renderToStaticMarkup(<StudentForm student={profile} onCancel={() => {}} />);
      const input = html.match(/<input[^>]*id="date_of_birth"[^>]*>/)?.[0];
      expect(input).toContain(`max="${studentToday()}"`);
    }
  });
  it('prefills the surname from last_name when editing', () => {
    const html = renderToStaticMarkup(<StudentForm student={student({ last_name: 'Zamani' })} onCancel={() => {}} />);

    expect(lastNameInputValue(html)).toBe('Zamani');
  });

  it('prefills the surname from the legacy key during the rollout', () => {
    const html = renderToStaticMarkup(<StudentForm student={student({ ['lastå_name']: 'Zamani' })} onCancel={() => {}} />);

    expect(lastNameInputValue(html)).toBe('Zamani');
  });

  it('leaves the surname empty on a new student', () => {
    const html = renderToStaticMarkup(<StudentForm onCancel={() => {}} />);

    expect(lastNameInputValue(html)).toBe('');
  });
});
