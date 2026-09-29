import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contract test for the KEL-114 cursor rules in `app/globals.css`.
 *
 * CSS murni tidak punya pola render test di repo ini, jadi test ini
 * memverifikasi aturan base ada di file (happy path), elemen
 * `aria-disabled` tetap `not-allowed` (error path), dan tidak ada
 * override yang menyentuh link atau opacity (regresi).
 */
const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

describe('globals.css cursor base rules (KEL-114)', () => {
  it('memberi pointer ke elemen yang dapat diklik (happy path)', () => {
    expect(css).toContain('button:not(:disabled)');
    expect(css).toContain("[role='tab']:not([aria-disabled='true'])");
    expect(css).toContain("label:has(input[type='checkbox'], input[type='radio'])");
    expect(css).toMatch(/cursor:\s*pointer/);
  });

  it('memberi not-allowed ke elemen disabled termasuk aria-disabled tanpa disabled (error path)', () => {
    expect(css).toContain('button:disabled');
    expect(css).toContain("[aria-disabled='true']");
    expect(css).toMatch(/cursor:\s*not-allowed/);
  });

  it('tidak mengubah link bawaan browser atau opacity (regresi)', () => {
    expect(css).not.toMatch(/(^|[\s,{])a[\s,{]/m);
    expect(css).not.toContain('opacity');
  });
});
