import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DeleteStudentButton } from './DeleteStudentButton';

const STUDENT_ID = '123e4567-e89b-42d3-a456-426614174000';

function render() {
  return renderToStaticMarkup(<DeleteStudentButton studentId={STUDENT_ID} />);
}

describe('DeleteStudentButton', () => {
  it('renders a labelled confirmation dialog with cancel and delete actions', () => {
    const html = render();

    expect(html).toContain('<button type="button"');
    expect(html).toContain('>Hapus</button>');
    expect(html).toContain('<dialog');
    expect(html).toContain(`aria-labelledby="delete-student-title-${STUDENT_ID}"`);
    expect(html).toContain(`id="delete-student-title-${STUDENT_ID}"`);
    expect(html).toContain('Hapus profil student ini?');
    expect(html).toContain('>Batal</button>');
    expect(html).toContain('>Hapus</button>');
  });

  it('keeps the existing server action form and student identifier', () => {
    const html = render();

    expect(html).toContain('<form');
    expect(html).toContain(`name="student_id" value="${STUDENT_ID}"`);
    expect(html).toContain('name="student_id"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('confirm(');
  });

  it('uses non-submit cancellation so closing the dialog cannot submit the form', () => {
    const html = render();
    const cancelButton = html.match(/<button[^>]*>Batal<\/button>/)?.[0];

    expect(cancelButton).toContain('type="button"');
    expect(html).toContain('aria-labelledby');
    expect(html).toContain('Hapus profil student ini?');
  });
});