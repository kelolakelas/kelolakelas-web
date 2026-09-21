import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TenantLocationForm } from './TenantLocationForm';
import { TenantProfileForm } from './TenantProfileForm';

/**
 * Render tests for the tenant settings forms (KEL-34).
 *
 * The acceptance criteria are about what a tenant sees: the stored values
 * pre-filled so a reload shows what was saved, the geocoded result displayed
 * after a save, and a member without `tenant:update` not being handed an
 * editable form. `renderToStaticMarkup` is used directly because these are
 * Server-rendered Client Components with no data-fetching of their own, so the
 * markup is the whole contract and no DOM testing library is needed.
 */

const PROFILE = {
  id: '9f1b1d5e-0a2c-4b3d-8e4f-5a6b7c8d9e0f',
  name: 'Bimbel Nusantara',
  phone: '08123456789',
  address: 'Jl. Merdeka 1',
  about: 'Bimbel untuk kelas 4-6',
};

describe('TenantProfileForm', () => {
  it('pre-fills every stored value so a reload shows what was saved', () => {
    const html = renderToStaticMarkup(
      <TenantProfileForm profile={PROFILE} readOnly={false} />
    );

    expect(html).toContain('value="Bimbel Nusantara"');
    expect(html).toContain('value="08123456789"');
    expect(html).toContain('value="Jl. Merdeka 1"');
    expect(html).toContain('Bimbel untuk kelas 4-6');
    expect(html).toContain('Simpan profil');
  });

  it('renders an absent optional value as an empty field rather than "undefined"', () => {
    const html = renderToStaticMarkup(
      <TenantProfileForm profile={{ id: 'p1', name: 'Tenant Baru' }} readOnly={false} />
    );

    // The fields are asserted individually because React's own hydration script
    // is part of the markup and contains unrelated tokens; what matters is that
    // no field was rendered with a literal `undefined` value.
    const values = [...html.matchAll(/value="([^"]*)"/g)].map((match) => match[1]);

    expect(values).toEqual(['Tenant Baru', '', '']);
    expect(values).not.toContain('undefined');
  });

  it('renders an about column written as an object instead of failing', () => {
    // Registration writes a JSON string, but the column accepts any JSON, so a
    // row written by another writer must still render a usable textarea.
    const html = renderToStaticMarkup(
      <TenantProfileForm
        profile={{ ...PROFILE, about: { motto: 'Belajar seru' } }}
        readOnly={false}
      />
    );

    expect(html).toContain('motto: Belajar seru');
  });

  it('offers no submit control when the form is read-only', () => {
    const html = renderToStaticMarkup(
      <TenantProfileForm profile={PROFILE} readOnly />
    );

    expect(html).not.toContain('Simpan profil');
    // The fieldset disable keeps the values visible while making them unsendable.
    expect(html).toContain('disabled');
  });

  it('labels the name field as required because identity requires it', () => {
    const html = renderToStaticMarkup(
      <TenantProfileForm profile={PROFILE} readOnly={false} />
    );

    expect(html).toContain('Nama tenant');
    expect(html).toContain('required');
  });
});

describe('TenantLocationForm', () => {
  it('pre-fills the stored address and coordinates', () => {
    const html = renderToStaticMarkup(
      <TenantLocationForm
        location={{
          address: 'Jl. Merdeka 1',
          latitude: -6.2,
          longitude: 106.8166667,
        }}
        readOnly={false}
      />
    );

    expect(html).toContain('value="Jl. Merdeka 1"');
    expect(html).toContain('value="-6.2"');
    expect(html).toContain('value="106.8166667"');
    expect(html).toContain('Simpan lokasi');
  });

  it('shows the geocoded address the backend stored, not just the typed one', () => {
    const html = renderToStaticMarkup(
      <TenantLocationForm
        location={{
          address: 'Jl. Merdeka 1',
          address_formatted: 'Jalan Merdeka No. 1, Jakarta Pusat',
          latitude: -6.2,
          longitude: 106.8166667,
        }}
        readOnly={false}
      />
    );

    expect(html).toContain('Hasil geocode:');
    expect(html).toContain('Jalan Merdeka No. 1, Jakarta Pusat');
    expect(html).toContain('-6.2, 106.8166667');
  });

  it('tells the tenant that coordinates are optional and derived when absent', () => {
    const html = renderToStaticMarkup(
      <TenantLocationForm location={{ address: 'Jl. Merdeka 1' }} readOnly={false} />
    );

    expect(html).toContain('Belum ada. Sistem akan mencari koordinat dari alamat saat disimpan.');
    expect(html).toContain('Latitude (opsional)');
    expect(html).toContain('Longitude (opsional)');
  });

  it('explains what a missing location means for the catalog', () => {
    const html = renderToStaticMarkup(
      <TenantLocationForm location={null} readOnly={false} />
    );

    expect(html).toContain('Lokasi belum diatur');
    expect(html).toContain('pencarian katalog berbasis radius');
  });

  it('offers no submit control when the form is read-only', () => {
    const html = renderToStaticMarkup(
      <TenantLocationForm location={null} readOnly />
    );

    expect(html).not.toContain('Simpan lokasi');
  });
});
