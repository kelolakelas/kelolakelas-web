import { describe, expect, it } from 'vitest';
import {
  CLASS_EDIT_FORBIDDEN_MESSAGE,
  classUpdateErrorMessage,
  editableDescriptionText,
} from './class-edit';

describe('classUpdateErrorMessage', () => {
  it('explains an expired session instead of showing a raw 401', () => {
    expect(classUpdateErrorMessage(401)).toContain('session has expired');
  });

  it('names the missing permission when the tenant member is forbidden', () => {
    expect(classUpdateErrorMessage(403)).toBe(CLASS_EDIT_FORBIDDEN_MESSAGE);
    expect(CLASS_EDIT_FORBIDDEN_MESSAGE).toContain('class:update');
  });

  it('tells the tenant the class is gone when another member deleted it', () => {
    expect(classUpdateErrorMessage(404)).toContain('no longer exists');
  });

  it('reports an unavailable authorization service as retryable', () => {
    expect(classUpdateErrorMessage(503)).toContain('authorization service is unavailable');
  });

  it('passes a backend validation message through verbatim', () => {
    expect(classUpdateErrorMessage(422, 'class price must not be negative')).toBe(
      'class price must not be negative'
    );
  });

  it('falls back to a generic message when the backend sends nothing usable', () => {
    expect(classUpdateErrorMessage(500, '   ')).toBe(
      'Failed to update the class. Please try again.'
    );
    expect(classUpdateErrorMessage(500, null)).toBe(
      'Failed to update the class. Please try again.'
    );
  });
});

describe('editableDescriptionText', () => {
  it('keeps a plain string description', () => {
    expect(editableDescriptionText('Belajar pecahan')).toBe('Belajar pecahan');
  });

  it('unwraps the object form the backend may have stored', () => {
    expect(editableDescriptionText({ text: 'Belajar pecahan' })).toBe('Belajar pecahan');
  });

  it('shows an absent description as empty rather than as an object', () => {
    expect(editableDescriptionText(undefined)).toBe('');
    expect(editableDescriptionText(null)).toBe('');
    expect(editableDescriptionText({ html: '<b>x</b>' })).toBe('');
    expect(editableDescriptionText(42)).toBe('');
  });
});
