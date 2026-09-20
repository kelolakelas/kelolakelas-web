import { describe, expect, it } from 'vitest';
import { updateClassSchema } from './schema';

/**
 * These cases pin the update contract to the academic service endpoint
 * (`PATCH /api/v1/classes/:id`). The schema is the only place the browser-side
 * shape is decided, so a regression here would either block a legitimate edit
 * or forward a field the backend refuses to change.
 */

const validPayload = {
  class_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
  category_id: '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d',
  name: 'Matematika Dasar',
  price: 150000,
  description: 'Kelas pengantar matematika.',
};

describe('updateClassSchema', () => {
  it('accepts the editable fields and keeps the numeric price', () => {
    const result = updateClassSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPayload);
    }
  });

  it('normalises a grouped rupiah price typed by the tenant', () => {
    const cases: Array<[string, number]> = [
      ['150000', 150000],
      ['1500000', 1500000],
      ['Rp 1.500.000', 1500000],
      ['rp.1500000', 1500000],
      ['1,500,000', 1500000],
      ['1 500 000', 1500000],
      ['1.500', 1500],
    ];

    for (const [typed, expected] of cases) {
      const result = updateClassSchema.safeParse({ ...validPayload, price: typed });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(expected);
      }
    }
  });

  it('rejects a price that is not a whole rupiah amount', () => {
    for (const price of ['1.50', '1.2.3', 'abc', '', '  ', 1.5]) {
      const result = updateClassSchema.safeParse({ ...validPayload, price });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.price?.length).toBe(1);
      }
    }
  });

  it('rejects a negative price with a dedicated message', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, price: '-1500' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.price?.[0]).toBe(
        'Price cannot be negative'
      );
    }
  });

  it('rejects a price beyond the safe integer range', () => {
    const result = updateClassSchema.safeParse({
      ...validPayload,
      price: '9007199254740993',
    });

    expect(result.success).toBe(false);
  });

  it('requires a class name and reports it against the name field', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, name: '   ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name?.[0]).toBe(
        'Class name is required'
      );
    }
  });

  it('requires the class identifier and a category', () => {
    const result = updateClassSchema.safeParse({
      ...validPayload,
      class_id: '',
      category_id: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.class_id?.[0]).toBe('Please select a valid class');
      expect(errors.category_id?.[0]).toBe('Please select a valid category');
    }
  });

  it('treats a missing description as valid', () => {
    const result = updateClassSchema.safeParse({
      class_id: validPayload.class_id,
      category_id: validPayload.category_id,
      name: validPayload.name,
      price: validPayload.price,
    });

    expect(result.success).toBe(true);
  });

  it('keeps a cleared description as an empty string so it is submitted', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, description: '' });

    expect(result.success).toBe(true);
    if (result.success) {
      // An empty string is what lets the action clear a stored description.
      // Dropping the key instead would make the PATCH a silent no-op.
      expect(result.data.description).toBe('');
      expect('description' in result.data).toBe(true);
    }
  });

  it('refuses to submit a class type because the backend forbids the change', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, type: 'private' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });

  it('refuses to submit a capacity because schedule capacity replaced it', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, capacity: 5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });
});
