import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ClassCreationWizard,
  PrivateClassScheduleNotice,
} from './ClassCreationWizard';
import type { Category } from '../_lib/schema';

/**
 * Render tests for the private-class branch of the creation wizard (KEL-50).
 *
 * The acceptance criterion is that a private class finishes the wizard without
 * a 400 from the schedules endpoint, because the academic service requires an
 * `enrollment_id` on every private schedule. The wizard therefore ends step 3
 * for a private class on an explanation plus a finish button instead of the
 * schedule form. The modal and its steps sit behind click handlers, which
 * static markup rendering cannot reach, so the private step is asserted by
 * rendering the exported branch component directly — the same component the
 * wizard mounts for `createdClass.type === 'private'`.
 */

const CATEGORY: Category = {
  id: 'cat-1',
  tenant_id: 'tenant-1',
  name: 'Matematika',
  created_at: '2026-09-01T00:00:00Z',
};

describe('ClassCreationWizard', () => {
  it('renders the creation trigger for opening the wizard', () => {
    const html = renderToStaticMarkup(
      <ClassCreationWizard existingCategories={[CATEGORY]} />
    );

    expect(html).toContain('Create New Class');
  });
});

describe('PrivateClassScheduleNotice (private wizard step)', () => {
  it('explains the per-enrollment scheduling instead of a slot form', () => {
    const html = renderToStaticMarkup(
      <PrivateClassScheduleNotice className="Fisika Privat" onFinish={() => {}} />
    );

    expect(html).toContain('Fisika Privat');
    expect(html).toContain('private');
    expect(html).toContain('No timetable needed yet.');
    expect(html).toContain('Finish Class Setup');
    // The slot form of the group path must not be part of this step.
    expect(html).not.toContain('Weekly Recurring Timetable');
    expect(html).not.toContain('Add Slot');
  });
});
