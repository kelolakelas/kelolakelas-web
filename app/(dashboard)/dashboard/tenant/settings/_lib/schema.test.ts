import { describe, expect, it } from 'vitest';
import {
  aboutToText,
  isForbiddenStatus,
  isUnauthorizedStatus,
  TENANT_SETTINGS_FORBIDDEN_MESSAGE,
  tenantLocationSchema,
  tenantProfileSchema,
  tenantSettingsErrorMessage,
  textToAbout,
} from './schema';

/**
 * The settings screen has no browser-side dependency on the backend contract,
 * so these tests pin the two things that would otherwise only fail in
 * production: the exact request shape the identity endpoints accept, and the
 * message mapping for the failures a tenant is actually expected to hit.
 */

describe('tenantProfileSchema', () => {
  it('accepts the fields the identity settings endpoint requires', () => {
    const result = tenantProfileSchema.safeParse({
      name: '  Bimbel Nusantara  ',
      phone: ' 08123456789 ',
      address: 'Jl. Merdeka 1',
      about: 'Bimbel untuk kelas 4-6',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Trimming is applied here because the identity column stores the value as
    // typed; a padded name would otherwise become a different tenant name.
    expect(result.data.name).toBe('Bimbel Nusantara');
    expect(result.data.phone).toBe('08123456789');
    expect(result.data.address).toBe('Jl. Merdeka 1');
    expect(result.data.about).toBe('Bimbel untuk kelas 4-6');
  });

  it('omits optional fields that were left blank instead of clearing them', () => {
    const result = tenantProfileSchema.safeParse({
      name: 'Bimbel Nusantara',
      phone: '',
      address: '   ',
      about: '',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phone).toBeUndefined();
    expect(result.data.address).toBeUndefined();
    expect(result.data.about).toBeUndefined();
  });

  it('rejects a blank name because identity marks it required', () => {
    const result = tenantProfileSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Nama tenant wajib diisi.');
  });

  it('rejects a name longer than the stored column', () => {
    const result = tenantProfileSchema.safeParse({ name: 'a'.repeat(256) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Nama tenant maksimal 255 karakter.');
  });

  it('rejects a phone longer than the stored column', () => {
    const result = tenantProfileSchema.safeParse({
      name: 'Bimbel Nusantara',
      phone: '0'.repeat(51),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Nomor telepon maksimal 50 karakter.');
  });
});

describe('tenantLocationSchema', () => {
  it('accepts an address on its own so the backend can geocode it', () => {
    const result = tenantLocationSchema.safeParse({ address: 'Jl. Merdeka 1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.address).toBe('Jl. Merdeka 1');
    expect(result.data.latitude).toBeUndefined();
    expect(result.data.longitude).toBeUndefined();
  });

  it('accepts a coordinate pair submitted as form text', () => {
    const result = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: '-6.2000000',
      longitude: '106.8166667',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.latitude).toBe(-6.2);
    expect(result.data.longitude).toBe(106.8166667);
  });

  it('treats an untouched coordinate input as absent', () => {
    const result = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: '',
      longitude: '   ',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.latitude).toBeUndefined();
    expect(result.data.longitude).toBeUndefined();
  });

  it('refuses a lone latitude because identity validates the pair', () => {
    const result = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: '-6.2',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['longitude']);
    expect(result.error.issues[0]?.message).toBe(
      'Latitude dan longitude harus diisi bersamaan.'
    );
  });

  it('refuses a lone longitude for the same reason', () => {
    const result = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      longitude: '106.8',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(
      'Latitude dan longitude harus diisi bersamaan.'
    );
  });

  it('rejects coordinates outside the accepted range', () => {
    const tooFarNorth = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: '91',
      longitude: '106.8',
    });
    const tooFarWest = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: '-6.2',
      longitude: '-181',
    });

    expect(tooFarNorth.success).toBe(false);
    expect(tooFarWest.success).toBe(false);
  });

  it('rejects a non-numeric coordinate rather than sending NaN', () => {
    const result = tenantLocationSchema.safeParse({
      address: 'Jl. Merdeka 1',
      latitude: 'selatan',
      longitude: '106.8',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a blank address because identity marks it required', () => {
    const result = tenantLocationSchema.safeParse({ address: '  ' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Alamat wajib diisi.');
  });

  it('rejects an address longer than the stored column', () => {
    const result = tenantLocationSchema.safeParse({ address: 'a'.repeat(501) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Alamat maksimal 500 karakter.');
  });
});

describe('aboutToText', () => {
  it('renders the JSON string registration stores', () => {
    expect(aboutToText('Bimbel untuk kelas 4-6')).toBe('Bimbel untuk kelas 4-6');
  });

  it('renders an object shape without throwing', () => {
    expect(aboutToText({ motto: 'Belajar seru', founded: 2015, empty: '' })).toBe(
      'motto: Belajar seru\nfounded: 2015'
    );
  });

  it('renders an absent value as an empty field', () => {
    expect(aboutToText(undefined)).toBe('');
    expect(aboutToText(null)).toBe('');
  });

  it('renders an unexpected shape as an empty field instead of failing', () => {
    // A row written by a version of the API this screen does not know about must
    // not stop the page from rendering.
    expect(aboutToText(42)).toBe('');
    expect(aboutToText(true)).toBe('');
  });
});

describe('textToAbout', () => {
  it('keeps typed text as a JSON string', () => {
    expect(textToAbout('  Bimbel untuk kelas 4-6  ')).toBe('Bimbel untuk kelas 4-6');
  });

  it('omits a blank field so the stored value is left alone', () => {
    expect(textToAbout('')).toBeUndefined();
    expect(textToAbout('   ')).toBeUndefined();
  });
});

describe('tenantSettingsErrorMessage', () => {
  it('reports a missing permission as an actionable state', () => {
    expect(tenantSettingsErrorMessage(403)).toBe(TENANT_SETTINGS_FORBIDDEN_MESSAGE);
  });

  it('reports an expired session as a session problem', () => {
    expect(tenantSettingsErrorMessage(401)).toContain('Sesi Anda sudah berakhir');
  });

  it('reports an unavailable authorization lookup separately from a denial', () => {
    const message = tenantSettingsErrorMessage(503);

    expect(message).toContain('Layanan otorisasi');
    expect(message).not.toBe(TENANT_SETTINGS_FORBIDDEN_MESSAGE);
  });

  it('passes a naming conflict through because only the backend knows it', () => {
    expect(tenantSettingsErrorMessage(500, 'tenant name already exists')).toBe(
      'tenant name already exists'
    );
  });

  it('falls back when the backend answered without a usable message', () => {
    expect(tenantSettingsErrorMessage(500)).toBe(
      'Pengaturan tenant belum dapat dimuat. Coba muat ulang beberapa saat lagi.'
    );
    expect(tenantSettingsErrorMessage(500, '   ')).toBe(
      'Pengaturan tenant belum dapat dimuat. Coba muat ulang beberapa saat lagi.'
    );
  });

  it('ignores the handler-level fallback text that names no cause', () => {
    expect(tenantSettingsErrorMessage(500, 'Failed to update tenant settings')).toBe(
      'Pengaturan tenant belum dapat dimuat. Coba muat ulang beberapa saat lagi.'
    );
  });
});

describe('authorization status helpers', () => {
  it('separates an expired session from a denied permission', () => {
    expect(isUnauthorizedStatus(401)).toBe(true);
    expect(isUnauthorizedStatus(403)).toBe(false);
    expect(isForbiddenStatus(403)).toBe(true);
    expect(isForbiddenStatus(401)).toBe(false);
    expect(isForbiddenStatus(500)).toBe(false);
  });
});
