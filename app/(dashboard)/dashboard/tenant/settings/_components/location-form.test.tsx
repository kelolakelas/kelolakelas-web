// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Interaction tests for the tenant location form (KEL-174).
 *
 * The acceptance criteria are about what the tenant experiences after
 * pressing save: a valid save announces success, and a failed one explains
 * itself. The form's Server Action is replaced with a mock so these tests
 * pin the announcement behaviour without reaching the network; the action's
 * own contract (payload, validation, revalidation) is covered by
 * `settingsActions.test.ts`.
 *
 * The revalidate simulation below mirrors what `updateTenantLocation` does
 * after a save: it calls `revalidatePath`, so the page re-renders with fresh
 * server values. The success announcement must survive that update.
 */

const mocks = vi.hoisted(() => ({ updateLocation: vi.fn() }));
vi.mock('../_actions/settingsActions', () => ({
  updateTenantLocation: mocks.updateLocation,
}));

const { TenantLocationForm } = await import('./TenantLocationForm');

const LOCATION = {
  address: 'Jl. Merdeka 1',
  latitude: -6.2,
  longitude: 106.8166667,
};

function inputOf(container: HTMLElement, name: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`missing input ${name}`);
  return input;
}

beforeEach(() => {
  mocks.updateLocation.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TenantLocationForm action feedback', () => {
  it('announces a saved location as a success status', async () => {
    mocks.updateLocation.mockResolvedValue({
      status: 'success',
      message: 'Lokasi tenant berhasil disimpan.',
    });
    render(<TenantLocationForm location={LOCATION} readOnly={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'Lokasi tenant berhasil disimpan.'
    );
    expect(mocks.updateLocation).toHaveBeenCalledTimes(1);
  });

  it('keeps the success message and persisted coordinates across successive saves', async () => {
    mocks.updateLocation.mockResolvedValue({
      status: 'success',
      message: 'Lokasi tenant berhasil disimpan.',
    });
    // The first save starts from no stored location: the tenant types an
    // address with a coordinate pair and submits.
    const { container, rerender } = render(
      <TenantLocationForm location={null} readOnly={false} />
    );
    fireEvent.change(inputOf(container, 'address'), {
      target: { value: 'Jl. Merdeka 1' },
    });
    fireEvent.change(inputOf(container, 'latitude'), {
      target: { value: '-6.2' },
    });
    fireEvent.change(inputOf(container, 'longitude'), {
      target: { value: '106.8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));
    await screen.findByRole('status');

    // `revalidatePath` in the action re-renders the page with the persisted
    // row. The form keeps its state across that update (stable key), so the
    // announcement must still be there, the summary must show the server's
    // latest coordinates, and the inputs must show the same persisted values
    // rather than the pre-save empties.
    rerender(
      <TenantLocationForm
        location={{
          address: 'Jl. Merdeka 1',
          latitude: -6.2,
          longitude: 106.8,
          location_updated_at: '2026-10-09T10:01:00Z',
        }}
        readOnly={false}
      />
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Lokasi tenant berhasil disimpan.'
    );
    expect(screen.getByText('-6.2, 106.8')).toBeTruthy();
    expect(inputOf(container, 'address').value).toBe('Jl. Merdeka 1');
    expect(inputOf(container, 'latitude').value).toBe('-6.2');
    expect(inputOf(container, 'longitude').value).toBe('106.8');

    // A second save with distinct coordinates repeats the same contract:
    // success survives, and summary plus inputs converge on the newest
    // persisted coordinates.
    fireEvent.change(inputOf(container, 'latitude'), {
      target: { value: '-6.3' },
    });
    fireEvent.change(inputOf(container, 'longitude'), {
      target: { value: '107' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));
    await screen.findByRole('status');

    rerender(
      <TenantLocationForm
        location={{
          address: 'Jl. Merdeka 1',
          latitude: -6.3,
          longitude: 107,
          location_updated_at: '2026-10-09T10:02:00Z',
        }}
        readOnly={false}
      />
    );

    expect(mocks.updateLocation).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toBe(
      'Lokasi tenant berhasil disimpan.'
    );
    expect(screen.getByText('-6.3, 107')).toBeTruthy();
    expect(inputOf(container, 'latitude').value).toBe('-6.3');
    expect(inputOf(container, 'longitude').value).toBe('107');
  });

  it('reports a lone-coordinate validation failure as an alert', async () => {
    mocks.updateLocation.mockResolvedValue({
      status: 'error',
      message: 'Periksa kembali isian yang ditandai.',
      errors: { longitude: ['Latitude dan longitude harus diisi bersamaan.'] },
    });
    render(<TenantLocationForm location={LOCATION} readOnly={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    const alerts = await screen.findAllByRole('alert');
    expect(
      alerts.some((node) =>
        node.textContent?.includes('Latitude dan longitude harus diisi bersamaan.')
      )
    ).toBe(true);
  });

  it('reports a backend failure as an alert', async () => {
    mocks.updateLocation.mockResolvedValue({
      status: 'error',
      message: 'geocoding service unavailable',
    });
    render(<TenantLocationForm location={LOCATION} readOnly={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simpan lokasi' }));

    const alerts = await screen.findAllByRole('alert');
    expect(
      alerts.some((node) => node.textContent?.includes('geocoding service unavailable'))
    ).toBe(true);
  });

  it('offers no submit control when the form is read-only', () => {
    render(<TenantLocationForm location={LOCATION} readOnly />);

    expect(screen.queryByRole('button', { name: 'Simpan lokasi' })).toBeNull();
  });
});
