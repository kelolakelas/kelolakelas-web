import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

/**
 * Page-level regression test for the tenant settings screen (KEL-174).
 *
 * The page is a Server Component, so its queries and both forms are mocked
 * and the returned element tree is inspected directly. What is pinned here
 * is the actual bug: the location form used to be keyed on
 * `location_updated_at`, and because the update action revalidates this
 * screen (which changes the timestamp), every successful save re-mounted
 * the form and discarded the `useActionState` success message before the
 * tenant could read it. The key must therefore stay stable across a
 * revalidated timestamp change, while the fresh server values — including
 * new coordinates — still reach the form through props.
 */

import type { TenantLocation, TenantProfile } from './_lib/schema';

const getSettings = vi.fn();
vi.mock('./_queries/queries', () => ({
  getTenantSettings: (...args: unknown[]) => getSettings(...args),
}));

vi.mock('./_components/TenantLocationForm', () => ({
  TenantLocationForm: () => null,
}));
vi.mock('./_components/TenantProfileForm', () => ({
  TenantProfileForm: () => null,
}));

const { default: TenantSettingsPage } = await import('./page');

const PROFILE: TenantProfile = { id: '9f1b1d5e-0a2c-4b3d-8e4f-5a6b7c8d9e0f', name: 'Bimbel Nusantara' };
const LOCATION: TenantLocation = { address: 'Jl. Merdeka 1', latitude: -6.2, longitude: 106.8166667 };

function ok(profile = PROFILE, location = LOCATION) {
  return { profile, location, error: null, message: null };
}

function childAt(node: ReactElement, index: number): ReactElement {
  const children = (node.props as { children: ReactNode }).children;
  const list = (Array.isArray(children) ? children : [children]) as ReactElement[];
  return list[index];
}

/** The page renders header, profile section, location section; the location form is the section's second child. */
function locationFormOf(page: ReactElement): ReactElement {
  return childAt(childAt(page, 2), 1);
}

describe('tenant settings page', () => {
  it('keeps the location form mounted when revalidation changes coordinates', async () => {
    getSettings
      .mockResolvedValueOnce(
        ok(PROFILE, {
          ...LOCATION,
          latitude: -6.2,
          longitude: 106.8166667,
          location_updated_at: '2026-10-09T10:00:00Z',
        })
      )
      .mockResolvedValueOnce(
        ok(PROFILE, {
          ...LOCATION,
          address: 'Jl. Merdeka 2',
          latitude: -6.3,
          longitude: 107,
          location_updated_at: '2026-10-09T10:01:00Z',
        })
      );

    const before = (await TenantSettingsPage()) as ReactElement;
    const after = (await TenantSettingsPage()) as ReactElement;

    const formBefore = locationFormOf(before);
    const formAfter = locationFormOf(after);

    // A changed key re-mounts the form and wipes its action state; the key
    // must not move with the timestamp.
    expect(formAfter.key).toBe(formBefore.key);
    // The saved values still arrive, including the new persisted
    // coordinates: the summary above the inputs renders them from props, so
    // no re-mount is needed to show the geocoded answer.
    const saved = (formAfter.props as { location: TenantLocation }).location;
    expect(saved.address).toBe('Jl. Merdeka 2');
    expect(saved.latitude).toBe(-6.3);
    expect(saved.longitude).toBe(107);
  });
});
